/**
 * Actionable admin cards (WP7).
 *
 * Each card is derived from current server state at fetch time and links to
 * the screen that resolves it. A card is only produced while its count is
 * non-zero, so after the organiser fixes the underlying issue and the query
 * refetches, the card disappears instead of showing a stale count.
 */

import { findCourtConflicts, type CourtScheduledMatch, type UnavailableCourtPeriod } from "@/lib/courtConflicts";
import { findRestConflicts, type ScheduledMatch } from "@/lib/restConflicts";

export type AdminActionKind =
  | "missing_officials"
  | "schedule_conflicts"
  | "delayed_matches"
  | "unresolved_identities"
  | "unsynced_scores"
  | "sync_visibility";

export interface AdminActionCard {
  id: string;
  kind: AdminActionKind;
  severity: "high" | "medium";
  title: string;
  detail: string;
  count: number;
  /** In-app link: a path ("/tournament-admin?…") or an /admin hash tab ("#inbox"). */
  href: string;
  actionLabel: string;
}

export interface TournamentActionInput {
  id: string;
  name: string;
  lifecycle: string;
  officialCount: number;
  hardConflicts: number;
  warningConflicts: number;
  delayedMatches: number;
}

export interface AdminActionInput {
  tournaments: TournamentActionInput[];
  guestIdentities: number;
  /** null means the device queue could not be inspected; it must not be presented as zero. */
  unsyncedOnThisDevice: number | null;
}

export const DELAY_THRESHOLD_MINUTES = 15;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildAdminActionCards(input: AdminActionInput): AdminActionCard[] {
  const cards: AdminActionCard[] = [];
  for (const t of input.tournaments) {
    if (t.lifecycle !== "active" && t.lifecycle !== "upcoming") continue;
    if (t.officialCount === 0) {
      cards.push({
        id: `officials:${t.id}`,
        kind: "missing_officials",
        severity: t.lifecycle === "active" ? "high" : "medium",
        title: `${t.name}: no umpire or referee assigned`,
        detail:
          t.lifecycle === "active"
            ? "The tournament is running. Only admins can score or correct matches until an official is assigned."
            : "Assign at least one umpire or referee before the tournament starts.",
        count: 1,
        href: `/tournament-admin?id=${encodeURIComponent(t.id)}&tab=officials`,
        actionLabel: "Assign officials",
      });
    }
    const conflicts = t.hardConflicts + t.warningConflicts;
    if (conflicts > 0) {
      cards.push({
        id: `conflicts:${t.id}`,
        kind: "schedule_conflicts",
        severity: t.hardConflicts > 0 ? "high" : "medium",
        title: `${t.name}: ${plural(conflicts, "schedule conflict")}`,
        detail: [
          t.hardConflicts > 0 ? `${plural(t.hardConflicts, "match", "matches")} cannot start as scheduled` : null,
          t.warningConflicts > 0 ? `${plural(t.warningConflicts, "warning")} (short rest or tight court turnaround)` : null,
        ]
          .filter(Boolean)
          .join("; ") + ".",
        count: conflicts,
        href: `/tournament-admin?id=${encodeURIComponent(t.id)}&tab=schedule`,
        actionLabel: "Open order of play",
      });
    }
    if (t.delayedMatches > 0) {
      cards.push({
        id: `delayed:${t.id}`,
        kind: "delayed_matches",
        severity: t.lifecycle === "active" ? "high" : "medium",
        title: `${t.name}: ${plural(t.delayedMatches, "delayed match", "delayed matches")}`,
        detail: `Scheduled at least ${DELAY_THRESHOLD_MINUTES} minutes ago but not started. Review the authoritative schedule; no fixture is moved automatically.`,
        count: t.delayedMatches,
        href: `/tournament-admin?id=${encodeURIComponent(t.id)}&tab=schedule&attention=delayed`,
        actionLabel: "Review schedule",
      });
    }
  }
  if (input.guestIdentities > 0) {
    cards.push({
      id: "guests",
      kind: "unresolved_identities",
      severity: "medium",
      title: `${plural(input.guestIdentities, "guest identity", "guest identities")} to resolve`,
      detail: "Guest players are not linked to a member profile, so their matches don't count towards a player's history.",
      count: input.guestIdentities,
      href: "#guests",
      actionLabel: "Resolve guests",
    });
  }
  if (input.unsyncedOnThisDevice == null) {
    cards.push({
      id: "sync-visibility",
      kind: "sync_visibility",
      severity: "medium",
      title: "Score-sync status is unknown on this device",
      detail: "The local umpire queue could not be inspected. This is not an all-clear and says nothing about offline queues on other devices.",
      count: 0,
      href: "#umpire",
      actionLabel: "Check umpire mode",
    });
  } else if (input.unsyncedOnThisDevice > 0) {
    cards.push({
      id: "unsynced",
      kind: "unsynced_scores",
      severity: "high",
      title: `${plural(input.unsyncedOnThisDevice, "score update")} on this device not confirmed by the server`,
      detail: "Saved on this device only. Open umpire mode while online to retry. Other devices' queues are not visible here.",
      count: input.unsyncedOnThisDevice,
      href: "#umpire",
      actionLabel: "Open umpire mode",
    });
  }
  const rank = (c: AdminActionCard) => (c.severity === "high" ? 0 : 1);
  return cards.sort((a, b) => rank(a) - rank(b));
}

export interface DelayCandidate {
  scheduled_at?: string | null;
  started_at?: string | null;
  status?: string | null;
}

/** Estimated delay signal only: a past scheduled time is not a confirmed incident. */
export function countDelayedMatches(
  matches: DelayCandidate[],
  now = new Date(),
  thresholdMinutes = DELAY_THRESHOLD_MINUTES,
): number {
  const cutoff = now.getTime() - thresholdMinutes * 60_000;
  return matches.filter((match) => {
    const status = (match.status ?? "").toLowerCase();
    if (status !== "scheduled" && status !== "pending") return false;
    if (match.started_at || !match.scheduled_at) return false;
    const scheduled = Date.parse(match.scheduled_at);
    return Number.isFinite(scheduled) && scheduled <= cutoff;
  }).length;
}

type ConflictMatch = CourtScheduledMatch &
  ScheduledMatch & { schedule_override_at?: string | null };

const FINISHED = new Set(["completed", "walkover", "cancelled"]);

/**
 * Distinct open matches with a court or rest conflict, using the same
 * detectors and tournament policy as the Order of Play. Matches whose
 * conflict was accepted with an audited override are not counted again.
 */
export function countScheduleConflicts(
  matches: ConflictMatch[],
  policy: { minRestMinutes?: number; estimatedMinutes?: number; unavailablePeriods?: UnavailableCourtPeriod[] },
): { hard: number; warning: number } {
  const court = findCourtConflicts(matches, {
    estimatedMinutes: policy.estimatedMinutes,
    unavailablePeriods: policy.unavailablePeriods ?? [],
  });
  const rest = findRestConflicts(matches, {
    minRestMinutes: policy.minRestMinutes,
    estimatedMinutes: policy.estimatedMinutes,
  });
  const byId = new Map(matches.map((m) => [m.id, m]));
  const hard = new Set<string>();
  const warning = new Set<string>();
  const visit = (matchId: string, type: "hard" | "warning") => {
    const m = byId.get(matchId);
    if (!m || FINISHED.has(m.status) || m.schedule_override_at) return;
    (type === "hard" ? hard : warning).add(matchId);
  };
  for (const [id, list] of court) for (const c of list) visit(c.matchId ?? id, c.conflictType);
  for (const [id, list] of rest) for (const c of list) visit(c.matchId ?? id, c.conflictType);
  for (const id of hard) warning.delete(id);
  return { hard: hard.size, warning: warning.size };
}
