/**
 * Registration window for one tournament category (in-app registration).
 *
 * One pure rule with a SQL twin, `public.registration_category_state(...)`
 * (migration 20261123150100). Both are tested against the same case list,
 * `registrationWindowCases.json`: vitest reads it here, and
 * supabase/tests/registration_rehearse.mjs pastes it into the SQL assertions.
 *
 * | State        | When                                                         |
 * |--------------|--------------------------------------------------------------|
 * | hidden       | flag off, TEAM format, or status not upcoming/active         |
 * | not_open     | now < opening time (category opens_at, else tournament's)    |
 * | open         | between opening and deadline, not locked                     |
 * | closing_soon | open with less than 24 h to the deadline                     |
 * | locked       | locked_at set, deadline passed, or the category has a draw   |
 *
 * Deadline = category closes_at, else tournament form_close_date, else none.
 */

export type RegistrationState = "hidden" | "not_open" | "open" | "closing_soon" | "locked";
export type LockReason = "manual" | "deadline" | "draw";

export interface RegistrationWindowInput {
  /** tournaments.require_app_registration */
  flagOn: boolean;
  /** tournaments.format_family (OPEN_EVENT | TEAM) */
  formatFamily?: string | null;
  /** tournaments.status */
  status?: string | null;
  /** tournaments.registration_opens_at */
  tournamentOpensAt?: string | null;
  /** tournaments.form_close_date */
  tournamentClosesAt?: string | null;
  /** tournament_category_settings.opens_at */
  categoryOpensAt?: string | null;
  /** tournament_category_settings.closes_at */
  categoryClosesAt?: string | null;
  /** tournament_category_settings.locked_at */
  lockedAt?: string | null;
  /** The category already has draw matches. */
  hasDraw?: boolean;
  /** ISO time; defaults to the current time. */
  now?: string | Date;
}

export interface RegistrationWindow {
  state: RegistrationState;
  opensAt: string | null;
  closesAt: string | null;
  lockReason: LockReason | null;
  /** Open or closing soon: players may change their entry. */
  canEdit: boolean;
}

export const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;
const VISIBLE_STATUSES = ["upcoming", "active"];

function ms(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export function registrationWindow(input: RegistrationWindowInput): RegistrationWindow {
  const opensAt = input.categoryOpensAt || input.tournamentOpensAt || null;
  const closesAt = input.categoryClosesAt || input.tournamentClosesAt || null;
  const base = { opensAt, closesAt };

  if (
    !input.flagOn ||
    (input.formatFamily ?? "").toUpperCase() === "TEAM" ||
    !VISIBLE_STATUSES.includes((input.status ?? "").toLowerCase())
  ) {
    return { ...base, state: "hidden", lockReason: null, canEdit: false };
  }

  const now = ms(input.now ?? new Date()) ?? Date.now();
  if (input.hasDraw) return { ...base, state: "locked", lockReason: "draw", canEdit: false };
  if (input.lockedAt) return { ...base, state: "locked", lockReason: "manual", canEdit: false };

  const close = ms(closesAt);
  if (close != null && now >= close) return { ...base, state: "locked", lockReason: "deadline", canEdit: false };

  const open = ms(opensAt);
  if (open != null && now < open) return { ...base, state: "not_open", lockReason: null, canEdit: false };

  if (close != null && close - now < CLOSING_SOON_MS) {
    return { ...base, state: "closing_soon", lockReason: null, canEdit: true };
  }
  return { ...base, state: "open", lockReason: null, canEdit: true };
}

export type ReopenCheck =
  | { ok: true; needsNewDeadline: false }
  | { ok: false; reason: "draw_exists" | "needs_new_deadline" | "not_locked" };

/**
 * Reopen rule: allowed until the draw exists; clears locked_at; when the
 * deadline has passed, a new future deadline is required.
 */
export function canReopen(input: RegistrationWindowInput, newClosesAt?: string | null): ReopenCheck {
  const w = registrationWindow(input);
  if (w.state !== "locked") return { ok: false, reason: "not_locked" };
  if (w.lockReason === "draw" || input.hasDraw) return { ok: false, reason: "draw_exists" };
  const now = ms(input.now ?? new Date()) ?? Date.now();
  const close = ms(w.closesAt);
  if (close != null && close <= now) {
    const next = ms(newClosesAt ?? null);
    if (next == null || next <= now) return { ok: false, reason: "needs_new_deadline" };
  }
  return { ok: true, needsNewDeadline: false };
}

export const REGISTRATION_STATE_LABELS: Record<RegistrationState, string> = {
  hidden: "Not taking entries",
  not_open: "Not open yet",
  open: "Open",
  closing_soon: "Closing soon",
  locked: "Locked",
};
