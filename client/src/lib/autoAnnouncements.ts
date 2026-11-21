/**
 * Feed posts worked out from tournament data, so the Pulse Feed covers every
 * tournament without anyone typing an announcement.
 *
 * Each public tournament gets at most one post, for the stage it is in now:
 * registration (before play), under way, or results. The posts are computed
 * when the Feed loads rather than written into site_data `announcements`:
 * the admin editor saves that whole list in one write, so a background job
 * appending to it could be overwritten, and a computed post never goes stale
 * when an organiser moves dates or corrects a result.
 *
 * Admins hide a post by adding its `key` to `hiddenAuto` in the same
 * site_data value. Keys name the stage, so hiding a registration post does
 * not hide the results post that replaces it later.
 */

import { computeTournamentStatus, winnersFromFinals } from "@/lib/tournaments";
import { tournamentPath } from "@/lib/tournamentRoutes";
import { DISCIPLINE_LABELS, disciplineOf } from "@/lib/matchView";

/** Columns the Feed reads per tournament (plain JSON, safe to persist). */
export const AUTO_FEED_TOURNAMENT_COLUMNS =
  "id, name, status, form_status, form_url, form_close_date, start_date, end_date, venue, eligibility, created_at, archived_at, require_app_registration";

export interface AutoFeedFinal {
  category?: string | null;
  match_code?: string | null;
  round_name?: string | null;
  winner_side?: number | null;
  team1_label?: string | null;
  team2_label?: string | null;
}

export interface AutoFeedTournament {
  id: string;
  name: string;
  status: string;
  form_status?: string | null;
  form_url?: string | null;
  form_close_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  eligibility?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
  require_app_registration?: boolean | null;
  /** Final (and nearby) matches; only decided Finals are used. */
  tournament_matches?: AutoFeedFinal[] | null;
}

export type AutoPostStage = "registration" | "underway" | "results";
export type RegistrationState = "open" | "closing_soon" | "closed" | "none";

export interface AutoPostWinner {
  category: string;
  winner: string;
  runnerUp: string;
}

export interface AutoPostAction {
  label: string;
  href: string;
  /** true for the external registration form; false for in-app pages. */
  external: boolean;
}

export interface AutoAnnouncement {
  /** Stable hide key: `tournament:<id>:<stage>`. */
  key: string;
  tournamentId: string;
  stage: AutoPostStage;
  title: string;
  /** "Published" day (YYYY-MM-DD): when the current stage began, as far as the data says. */
  date: string;
  startDate?: string;
  endDate?: string;
  category: "tournament";
  /** Plain-text lines, rendered as text (never as HTML). */
  lines: string[];
  venue?: string;
  /** ISO time the registration form closes, while it is still open. */
  closesAt?: string;
  registration?: RegistrationState;
  winners?: AutoPostWinner[];
  actions: AutoPostAction[];
}

export function autoPostKey(tournamentId: string, stage: AutoPostStage): string {
  return `tournament:${tournamentId}:${stage}`;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Local calendar day of an ISO timestamp or a plain YYYY-MM-DD date. */
function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Registration form state, with a passed deadline counting as closed (same rule as the old banner). */
export function registrationState(t: AutoFeedTournament, now: Date = new Date()): RegistrationState {
  const status = t.form_status ?? "disabled";
  if (status === "disabled") return "none";
  if (t.form_close_date) {
    const closes = new Date(t.form_close_date).getTime();
    if (!Number.isNaN(closes) && now.getTime() >= closes) return "closed";
  }
  if (status === "open" || status === "closing_soon") return status;
  return "closed";
}

const DISCIPLINE_ORDER = ["MS", "WS", "MD", "WD", "XD"];

/** Decided Finals as display rows, in MS → WS → MD → WD → XD order, then the rest. */
export function feedWinners(matches: AutoFeedFinal[] | null | undefined): AutoPostWinner[] {
  const rows = winnersFromFinals(matches ?? []) ?? [];
  return rows
    .map((w) => {
      const d = disciplineOf(w.category);
      return {
        order: d ? DISCIPLINE_ORDER.indexOf(d) : DISCIPLINE_ORDER.length,
        category: d ? DISCIPLINE_LABELS[d] : clean(w.category) || "Final",
        winner: clean(w.winner),
        runnerUp: clean(w.runnerUp),
      };
    })
    .filter((w) => w.winner)
    .sort((a, b) => a.order - b.order || a.category.localeCompare(b.category))
    .map(({ order: _order, ...w }) => w);
}

/** The Feed post for one tournament, or null when it should not appear. */
export function buildAutoAnnouncement(t: AutoFeedTournament, now: Date = new Date()): AutoAnnouncement | null {
  if (!t?.id || !t.name || t.status === "draft" || t.status === "deleted") return null;
  const name = clean(t.name);
  const lifecycle = computeTournamentStatus(t);
  const startDate = dayOf(t.start_date) ?? undefined;
  const endDate = dayOf(t.end_date) ?? startDate;
  const venue = clean(t.venue) || undefined;
  const page = tournamentPath(t.id);
  const base = { tournamentId: t.id, category: "tournament" as const, startDate, endDate, venue };

  if (lifecycle === "completed" || lifecycle === "archived") {
    const winners = feedWinners(t.tournament_matches);
    return {
      ...base,
      key: autoPostKey(t.id, "results"),
      stage: "results",
      title: `Results: ${name}`,
      date: endDate ?? dayOf(t.archived_at) ?? dayOf(t.created_at) ?? "",
      lines: winners.length ? [] : [`${name} has finished.`],
      winners: winners.length ? winners : undefined,
      actions: [{ label: "Full results", href: tournamentPath(t.id, "results"), external: false }],
    };
  }

  if (lifecycle === "active") {
    return {
      ...base,
      key: autoPostKey(t.id, "underway"),
      stage: "underway",
      title: `Under way: ${name}`,
      date: startDate ?? dayOf(t.created_at) ?? "",
      lines: ["Live scores, the draw and the schedule are on the tournament page."],
      actions: [{ label: "Follow live", href: tournamentPath(t.id, "live"), external: false }],
    };
  }

  if (lifecycle !== "upcoming") return null;

  const reg = registrationState(t, now);
  const eligibility = clean(t.eligibility);
  const lines: string[] = [];
  const actions: AutoPostAction[] = [];
  let title: string;
  let date = dayOf(t.created_at) ?? startDate ?? "";

  if (reg === "open" || reg === "closing_soon") {
    title = `Registration open: ${name}`;
    lines.push(reg === "closing_soon" ? "Registration closes soon." : "Registration is open.");
    if (t.require_app_registration) actions.push({ label: "Register", href: page, external: false });
    else if (t.form_url && /^https?:\/\//i.test(t.form_url.trim())) {
      actions.push({ label: "Register", href: t.form_url.trim(), external: true });
    }
  } else if (reg === "closed") {
    title = `Registration closed: ${name}`;
    lines.push("Registration has closed. The draw and schedule will appear on the tournament page.");
    date = dayOf(t.form_close_date) ?? date;
  } else {
    title = `Coming up: ${name}`;
  }
  if (eligibility) lines.push(eligibility);
  actions.push({ label: "View tournament", href: page, external: false });

  return {
    ...base,
    key: autoPostKey(t.id, "registration"),
    stage: "registration",
    title,
    date,
    lines,
    registration: reg,
    closesAt: (reg === "open" || reg === "closing_soon") && t.form_close_date ? t.form_close_date : undefined,
    actions,
  };
}

/** Feed posts for a list of tournaments, without the ones an admin hid. */
export function buildAutoAnnouncements(
  tournaments: AutoFeedTournament[] | null | undefined,
  hidden: readonly string[] = [],
  now: Date = new Date(),
): AutoAnnouncement[] {
  if (!Array.isArray(tournaments)) return [];
  const hide = new Set(hidden);
  const out: AutoAnnouncement[] = [];
  for (const t of tournaments) {
    const post = buildAutoAnnouncement(t, now);
    if (post && !hide.has(post.key)) out.push(post);
  }
  return out;
}
