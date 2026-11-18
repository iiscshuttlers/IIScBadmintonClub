/**
 * Shared match-view model (WP6).
 *
 * Every competition surface (Match Centre, court queue, match page, and —
 * incrementally — schedule, live widgets, brackets and archive) renders a
 * `MatchView` instead of a raw `tournament_matches` row, so one corrected
 * result reads the same everywhere.
 *
 * Rules:
 *  - Status comes from the `status` column only; it is never inferred from a
 *    missing or present score.
 *  - Scheduled, actual-start and actual-end times are kept separate; nothing
 *    invents a time for an unscheduled match.
 *  - Court queues use the same order as the "up next" push alerts
 *    (supabase/functions/_shared/courtQueue.ts): live first, then
 *    scheduled_at (nulls last), round, match_number.
 */

import { parseDiscipline, type Discipline } from "@/lib/tournamentRoutes";

/** Columns every match surface needs; keep queries on this list. */
export const MATCH_VIEW_COLUMNS =
  "id, tournament_id, category, match_code, round, round_name, match_number, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, court_number, status, score, sets_history, scheduled_at, started_at, ended_at, winner_side, advances_to_match, rubber_label, tie_id, points_to_win";

export interface MatchRow {
  id: string;
  tournament_id: string;
  category: string | null;
  match_code: string | null;
  round: number | null;
  round_name: string | null;
  match_number: number | null;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  court_number: string | null;
  status: string;
  score: string | null;
  sets_history: string[] | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  winner_side: number | null;
  advances_to_match: string | null;
  rubber_label: string | null;
  tie_id: string | null;
  /** Game target (21, or 30 for single-game formats). Optional for older callers. */
  points_to_win?: number | null;
}

/** Statuses present in the domain today. There is no retirement status. */
export type MatchState = "unscheduled" | "scheduled" | "live" | "completed" | "walkover" | "cancelled" | "unknown";

export const LIVE_STATUSES: ReadonlySet<string> = new Set(["in_progress", "playing", "live", "ongoing"]);

export interface MatchSide {
  label: string;
  /** No entrant yet (bracket slot awaiting an earlier result). */
  isTbd: boolean;
  isBye: boolean;
  isWinner: boolean;
  seed: number | null;
  playerIds: string[];
}

export interface GameScore {
  side1: number;
  side2: number;
}

export interface MatchView {
  id: string;
  tournamentId: string;
  /** MS/WS/MD/WD/XD when recognisable, else null (e.g. team rubbers with custom names). */
  discipline: Discipline | null;
  categoryLabel: string;
  roundName: string;
  round: number | null;
  matchNumber: number | null;
  matchCode: string | null;
  rubberLabel: string | null;
  tieId: string | null;
  sides: [MatchSide, MatchSide];
  state: MatchState;
  /** Plain-text status label, always shown (never colour alone). */
  statusLabel: string;
  games: GameScore[];
  /** Raw score text when it cannot be parsed into games. */
  scoreText: string | null;
  court: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  nextMatchCode: string | null;
  /** Points needed to win a game (21 standard, 30 single-game), when known. */
  pointsToWin?: number | null;
}

const BYE_RE = /\bbye\b/i;

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

/** Recognise a discipline from the category text or the match code prefix. */
export function disciplineOf(category: string | null | undefined, matchCode?: string | null): Discipline | null {
  const direct = parseDiscipline((category ?? "").trim());
  if (direct) return direct;
  const c = (category ?? "").toUpperCase();
  if (c.includes("MIXED")) return "XD";
  if (c.includes("WOMEN'S SINGLES") || c.includes("WOMENS SINGLES")) return "WS";
  if (c.includes("WOMEN'S DOUBLES") || c.includes("WOMENS DOUBLES")) return "WD";
  if (c.includes("MEN'S SINGLES") || c.includes("MENS SINGLES")) return "MS";
  if (c.includes("MEN'S DOUBLES") || c.includes("MENS DOUBLES")) return "MD";
  const prefix = (matchCode ?? "").toUpperCase().match(/^(MS|WS|MD|WD|XD)(?:_|$)/);
  return prefix ? (prefix[1] as Discipline) : null;
}

export function matchState(row: Pick<MatchRow, "status" | "scheduled_at" | "court_number">): MatchState {
  const s = (row.status ?? "").toLowerCase();
  if (LIVE_STATUSES.has(s)) return "live";
  if (s === "completed" || s === "finished") return "completed";
  if (s === "walkover") return "walkover";
  if (s === "cancelled") return "cancelled";
  if (s === "scheduled" || s === "pending") return row.scheduled_at || row.court_number ? "scheduled" : "unscheduled";
  return "unknown";
}

export function stateLabel(state: MatchState, rawStatus?: string): string {
  switch (state) {
    case "live":
      return "Live";
    case "completed":
      return "Completed";
    case "walkover":
      return "Walkover";
    case "cancelled":
      return "Cancelled";
    case "scheduled":
      return "Scheduled";
    case "unscheduled":
      return "Not yet scheduled";
    default:
      return rawStatus ? rawStatus.replace(/_/g, " ") : "Unknown";
  }
}

/** "21-13" / "21–13" / "21:13" → {21,13}; anything else → null. */
function parseGame(text: string): GameScore | null {
  const m = text.trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/);
  return m ? { side1: Number(m[1]), side2: Number(m[2]) } : null;
}

/**
 * Game scores from `sets_history` (preferred) or the `score` text
 * ("21-13, 21-11"). Returns [] with the raw text preserved by the caller
 * when the score is not a list of games (e.g. a live "30-15" point score is
 * still a single game and parses fine).
 */
export function parseGames(setsHistory: string[] | null | undefined, score: string | null | undefined): GameScore[] {
  const fromSets = (setsHistory ?? []).map((s) => (typeof s === "string" ? parseGame(s) : null));
  if (fromSets.length > 0 && fromSets.every(Boolean)) return fromSets as GameScore[];
  if (!score) return [];
  const parts = score.split(/[,;/]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
  const games = parts.map(parseGame);
  return games.length > 0 && games.every(Boolean) ? (games as GameScore[]) : [];
}

/** Seed lookup: `${discipline or category}::${playerId}` → seed. */
export type SeedIndex = Map<string, number>;

export function buildSeedIndex(
  participants: Array<{ category: string | null; player_id: string | null; partner_id: string | null; seed: number | null }>,
): SeedIndex {
  const idx: SeedIndex = new Map();
  for (const p of participants) {
    if (p.seed == null) continue;
    const key = disciplineOf(p.category) ?? (p.category ?? "");
    for (const id of [p.player_id, p.partner_id]) if (id) idx.set(`${key}::${id}`, p.seed);
  }
  return idx;
}

function side(
  label: string | null,
  ids: Array<string | null>,
  isWinner: boolean,
  seedKey: string,
  seeds: SeedIndex | undefined,
): MatchSide {
  const playerIds = ids.filter((x): x is string => !!x);
  const text = (label ?? "").trim();
  const seed = seeds ? playerIds.map((id) => seeds.get(`${seedKey}::${id}`)).find((s) => s != null) ?? null : null;
  return {
    label: text || "To be decided",
    isTbd: !text || /^tbd$/i.test(text),
    isBye: BYE_RE.test(text),
    isWinner,
    seed,
    playerIds,
  };
}

export function toMatchView(row: MatchRow, seeds?: SeedIndex): MatchView {
  const discipline = disciplineOf(row.category, row.match_code);
  const state = matchState(row);
  const decided = state === "completed" || state === "walkover";
  const seedKey = discipline ?? row.category ?? "";
  const games = parseGames(row.sets_history, row.score);
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    discipline,
    categoryLabel: discipline ? DISCIPLINE_LABELS[discipline] : row.category ?? "",
    roundName: row.round_name ?? (row.round != null ? `Round ${row.round}` : ""),
    round: row.round,
    matchNumber: row.match_number,
    matchCode: row.match_code,
    rubberLabel: row.rubber_label,
    tieId: row.tie_id,
    sides: [
      side(row.team1_label, [row.player1_id, row.player3_id], decided && row.winner_side === 1, seedKey, seeds),
      side(row.team2_label, [row.player2_id, row.player4_id], decided && row.winner_side === 2, seedKey, seeds),
    ],
    state,
    statusLabel: stateLabel(state, row.status),
    games,
    scoreText: games.length === 0 && row.score ? row.score : null,
    court: row.court_number?.trim() || null,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    nextMatchCode: row.advances_to_match,
    pointsToWin: row.points_to_win ?? null,
  };
}

// ── Filters ────────────────────────────────────────────────────────────────

export type MatchBucket = "live" | "upcoming" | "completed";

export function bucketOf(v: MatchView): MatchBucket | null {
  switch (v.state) {
    case "live":
      return "live";
    case "scheduled":
    case "unscheduled":
      return "upcoming";
    case "completed":
    case "walkover":
    case "cancelled":
      return "completed";
    default:
      return null;
  }
}

/** Local calendar date (YYYY-MM-DD) a match belongs to: actual start, else schedule. */
export function matchDay(v: MatchView): string | null {
  const iso = v.startedAt ?? v.scheduledAt ?? v.endedAt;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface MatchFilters {
  discipline?: Discipline | null;
  court?: string | null;
  date?: string | null;
}

export function filterMatches(views: MatchView[], f: MatchFilters): MatchView[] {
  return views.filter(
    (v) =>
      (!f.discipline || v.discipline === f.discipline) &&
      (!f.court || v.court === f.court) &&
      (!f.date || matchDay(v) === f.date),
  );
}

/** Upcoming order: scheduled time (nulls last), round, match number. */
export function compareUpcoming(a: MatchView, b: MatchView): number {
  const ta = a.scheduledAt ? Date.parse(a.scheduledAt) : Number.POSITIVE_INFINITY;
  const tb = b.scheduledAt ? Date.parse(b.scheduledAt) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
  return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
}

/** Completed order: most recently finished first; unknown end times last. */
export function compareCompleted(a: MatchView, b: MatchView): number {
  const ta = a.endedAt ? Date.parse(a.endedAt) : Number.NEGATIVE_INFINITY;
  const tb = b.endedAt ? Date.parse(b.endedAt) : Number.NEGATIVE_INFINITY;
  if (ta !== tb) return tb - ta;
  if ((a.round ?? 0) !== (b.round ?? 0)) return (b.round ?? 0) - (a.round ?? 0);
  return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
}

// ── Court queue ────────────────────────────────────────────────────────────

/** Same order as `compareQueue` in supabase/functions/_shared/courtQueue.ts. */
export function compareCourtQueue(a: MatchView, b: MatchView): number {
  const la = a.state === "live" ? 0 : 1;
  const lb = b.state === "live" ? 0 : 1;
  if (la !== lb) return la - lb;
  return compareUpcoming(a, b);
}

export interface CourtQueue {
  court: string;
  playing: MatchView[];
  next: MatchView | null;
  following: MatchView[];
}

/**
 * Per-court Playing / Next / Following. Only matches already assigned to a
 * court by an organiser are queued — nothing is moved or auto-assigned here.
 */
export function buildCourtQueues(views: MatchView[]): CourtQueue[] {
  const byCourt = new Map<string, MatchView[]>();
  for (const v of views) {
    if (!v.court) continue;
    if (v.state !== "live" && v.state !== "scheduled") continue;
    const list = byCourt.get(v.court) ?? [];
    list.push(v);
    byCourt.set(v.court, list);
  }
  return Array.from(byCourt.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([court, list]) => {
      const sorted = [...list].sort(compareCourtQueue);
      const playing = sorted.filter((v) => v.state === "live");
      const waiting = sorted.filter((v) => v.state !== "live");
      return { court, playing, next: waiting[0] ?? null, following: waiting.slice(1) };
    });
}

/** "C1" / "court 1" / "1" → "Court 1"; other names pass through. Mirrors courtQueue.ts. */
export function courtLabel(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(?:c(?:ourt)?\s*)?(\d+)$/i);
  return m ? `Court ${m[1]}` : t;
}

// ── Lightweight adapter for surfaces that keep their own layout ─────────────

/**
 * Status, winner and game scores for a partial match row (brackets, roadmap,
 * schedule cards). Same rules as `toMatchView`: status from the column only,
 * winners only for completed/walkover, games via `parseGames`.
 */
export interface MatchOutcome {
  state: MatchState;
  statusLabel: string;
  /** Completed or walkover: a winner may be shown. */
  decided: boolean;
  t1Won: boolean;
  t2Won: boolean;
  games: GameScore[];
  scoreText: string | null;
}

export function matchOutcome(m: {
  status: string;
  winner_side?: number | null;
  score?: string | null;
  sets_history?: string[] | null;
  scheduled_at?: string | null;
  court_number?: string | null;
}): MatchOutcome {
  const state = matchState({ status: m.status, scheduled_at: m.scheduled_at ?? null, court_number: m.court_number ?? null });
  const decided = state === "completed" || state === "walkover";
  const games = parseGames(m.sets_history, m.score);
  return {
    state,
    statusLabel: stateLabel(state, m.status),
    decided,
    t1Won: decided && m.winner_side === 1,
    t2Won: decided && m.winner_side === 2,
    games,
    scoreText: games.length === 0 && m.score ? m.score : null,
  };
}
