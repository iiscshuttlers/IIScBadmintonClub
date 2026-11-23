/**
 * Pure rules for dispatch-scheduled-notifications (no Deno imports, so vitest
 * covers them: test/lib/dispatchRules.test.ts).
 *
 * - Target selection: who gets push / email. Registration notices email
 *   everyone with an address (they ignore pref_receive_email and the category
 *   pref); every other kind keeps today's behaviour.
 * - Retry: only registration rows retry (5 min, 30 min, 2 h; then failed), and a
 *   retry sends only the channels not yet delivered.
 * - Stuck rows: a row left in "sending" for over 10 minutes goes back to pending.
 */

export interface TargetPlayer {
  id: string;
  email?: string | null;
  iisc_email?: string | null;
  pref_receive_push?: boolean | null;
  pref_receive_email?: boolean | null;
  [pref: string]: unknown;
}

export interface TargetOptions {
  /** Registration notices: email ignores pref_receive_email and the category pref. */
  emailIgnoresPrefs?: boolean;
}

export interface SelectedTargets {
  pushUserIds: string[];
  emails: { user_id: string; email: string | null; iisc_email: string | null }[];
}

export function selectTargets(players: TargetPlayer[], prefColumn: string, opts: TargetOptions = {}): SelectedTargets {
  const pushUserIds: string[] = [];
  const emails: SelectedTargets["emails"] = [];
  for (const p of players) {
    const categoryEnabled = p[prefColumn] !== false;
    const hasAddress = !!(p.email || p.iisc_email);
    if (categoryEnabled && p.pref_receive_push !== false) pushUserIds.push(p.id);
    const emailAllowed = opts.emailIgnoresPrefs ? true : categoryEnabled && p.pref_receive_email !== false;
    if (emailAllowed && hasAddress) {
      emails.push({ user_id: p.id, email: p.email ?? null, iisc_email: p.iisc_email ?? null });
    }
  }
  return { pushUserIds, emails };
}

export const ALL_CHANNELS = ["in_app", "email", "push"] as const;

/** Channels of a row still to deliver (a retry skips the delivered ones). */
export function channelsToSend(channels: string[] | null | undefined, delivered: string[] | null | undefined): string[] {
  const done = new Set(delivered ?? []);
  return (channels ?? []).filter((c) => !done.has(c));
}

export const RETRY_BACKOFF_MINUTES = [5, 30, 120];
export const MAX_ATTEMPTS = 3;
export const STUCK_AFTER_MS = 10 * 60 * 1000;

export type RetryDecision =
  | { status: "pending"; attempts: number; nextAttemptAt: string }
  | { status: "failed"; attempts: number };

/**
 * What to do with a row whose delivery failed. `attempts` is the count BEFORE
 * this failure. Only registration rows retry; others fail at once (today's flow).
 */
export function retryDecision(eventType: string | null | undefined, attempts: number, now: Date = new Date()): RetryDecision {
  const next = (attempts ?? 0) + 1;
  if (eventType !== "registration" || next >= MAX_ATTEMPTS) return { status: "failed", attempts: next };
  const mins = RETRY_BACKOFF_MINUTES[Math.min(next - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return { status: "pending", attempts: next, nextAttemptAt: new Date(now.getTime() + mins * 60_000).toISOString() };
}

/** A row claimed ("sending") longer ago than STUCK_AFTER_MS goes back to pending. */
export function isStuck(claimedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!claimedAt) return true;
  const t = Date.parse(claimedAt);
  return Number.isFinite(t) && now.getTime() - t > STUCK_AFTER_MS;
}

/** PostgREST filter for due pending rows: coalesce(next_attempt_at, scheduled_at) <= now. */
export function dueFilter(nowIso: string): string {
  return `next_attempt_at.lte.${nowIso},and(next_attempt_at.is.null,scheduled_at.lte.${nowIso})`;
}

/** Requeueing hit the pending group_key index: a newer pending row exists, so this older one is cancelled. */
export function isGroupKeyCollision(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === "23505" || /scheduled_notifications_pending_group_uidx/.test(error.message ?? ""));
}

/** Backup outbox: next try after a failed copy (same backoff), or null when it gives up. */
export function backupRetryAt(attempts: number, now: Date = new Date()): string | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const mins = RETRY_BACKOFF_MINUTES[Math.min(Math.max(attempts, 1) - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(now.getTime() + mins * 60_000).toISOString();
}
