/**
 * Pure logic behind the umpire's tournament tab: the format → category →
 * match drill-down, queue ordering, rule enrichment, list filters and the
 * "Enter Score" validation. Kept free of React so it can be tested directly.
 */
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";
import { checkMatchScore, gamesToWin, type MatchRules } from "@/lib/badmintonScore";
import { isByeLabel } from "@/lib/umpire/umpireStateLogic";

/** Where the umpire is in the format → category → match drill-down. */
export interface UmpireNav {
  step: "format" | "match" | "confirm";
  category: string | null;
  matchId: string | null;
}

export const UMPIRE_ROOT: UmpireNav = { step: "format", category: null, matchId: null };

/** One level up: match → its category (or formats, if opened from there) → formats. */
export function parentNav(nav: UmpireNav): UmpireNav | undefined {
  if (nav.step === "confirm") return nav.category ? { step: "match", category: nav.category, matchId: null } : UMPIRE_ROOT;
  if (nav.step === "match") return UMPIRE_ROOT;
  return undefined;
}

/** A step restored from history whose match (or category) is gone shows its parent view. */
export function resolveUmpireStep(nav: UmpireNav, hasSelectedMatch: boolean): UmpireNav["step"] {
  return nav.step === "confirm" && !hasSelectedMatch ? (nav.category ? "match" : "format")
    : nav.step === "match" && !nav.category ? "format"
    : nav.step;
}

type QueueMatch = Pick<TournamentMatchForUmpire, "status" | "round" | "match_number">;

/**
 * The status pill a match belongs to: scheduled and pending (waiting for an
 * earlier round) are both still to play. Null for any other status.
 */
export function statusBand(status: string): Exclude<UpcomingStatusFilter, "ALL"> | null {
  if (status === "scheduled" || status === "pending") return "upcoming";
  if (status === "in_progress") return "live";
  if (status === "completed" || status === "walkover") return "completed";
  return null;
}

/** Umpire queue order: live first, then everything still to play, then done; then by round and match number. */
export function compareUmpireQueue(a: QueueMatch, b: QueueMatch): number {
  const order = { live: 0, upcoming: 1, completed: 2 } as const;
  const priority = (s: string) => {
    const band = statusBand(s);
    return band ? order[band] : 1;
  };
  const pA = priority(a.status);
  const pB = priority(b.status);
  if (pA !== pB) return pA - pB;
  return (a.round || 1) - (b.round || 1) || (a.match_number || 1) - (b.match_number || 1);
}

export interface RoundRuleRow {
  tournament_id: string;
  category: string;
  round: number;
  points_to_win?: number | null;
  best_of_sets?: number | null;
  golden_point?: number | null;
}

/**
 * Attach the tournament name and the scoring rules to each match row. A
 * round rule for the same tournament, category and round wins over the
 * match's own columns; the fallback is 21 points, best of 3, cap at 30.
 */
export function enrichUmpireMatches(
  rows: any[],
  tournaments: { id: string; name: string }[],
  rules: RoundRuleRow[] | null | undefined,
): TournamentMatchForUmpire[] {
  return rows.map((m: any) => {
    const tournament = tournaments.find((t) => t.id === m.tournament_id);
    const rule = rules?.find(
      (r) => r.tournament_id === m.tournament_id && r.category === m.category && r.round === m.round
    );
    return {
      ...m,
      tournament_name: tournament?.name ?? "Tournament",
      points_to_win: rule?.points_to_win ?? m.points_to_win ?? 21,
      best_of_sets: rule?.best_of_sets ?? m.best_of_sets ?? 3,
      golden_point: rule?.golden_point ?? m.golden_point ?? 30,
    };
  });
}

type LabelledMatch = Pick<TournamentMatchForUmpire, "team1_label" | "team2_label">;

/**
 * A side is a bye: its label is exactly "BYE" (any case). Used to hide byes
 * from the queue. Names that merely contain "bye" ("Abbye Thomas", "Byers")
 * are players.
 */
export function hasByeSide(m: LabelledMatch): boolean {
  return isByeLabel(m.team1_label) || isByeLabel(m.team2_label);
}

/** Courts used by real (non-bye) matches, in natural order (C2 before C10). */
export function queueCourts(matches: TournamentMatchForUmpire[]): string[] {
  return [...new Set(matches.filter(m => m.court_number && !hasByeSide(m)).map(m => m.court_number!))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export type UpcomingStatusFilter = "ALL" | "upcoming" | "live" | "completed";

export interface UpcomingFilters {
  status: UpcomingStatusFilter;
  search: string;
  format: string;
  court: string;
}

/**
 * Whether a match belongs in the umpire's list under these filters: not a bye,
 * in the chosen status pill, and matching the search, format and court.
 */
function inUpcomingList(m: TournamentMatchForUmpire, filters: UpcomingFilters): boolean {
  if (hasByeSide(m)) return false;
  if (filters.status !== "ALL" && statusBand(m.status) !== filters.status) return false;
  if (filters.search.trim()) {
    const lowerQ = filters.search.toLowerCase();
    const hit =
      (m.team1_label?.toLowerCase() || "").includes(lowerQ) ||
      (m.team2_label?.toLowerCase() || "").includes(lowerQ) ||
      (m.match_code?.toLowerCase() || "").includes(lowerQ) ||
      (m.court_number?.toLowerCase() || "").includes(lowerQ);
    if (!hit) return false;
  }
  if (filters.format !== "ALL" && m.category !== filters.format) return false;
  if (filters.court !== "ALL" && m.court_number !== filters.court) return false;
  return true;
}

/**
 * The umpire's match list: byes dropped, status, search, format and court
 * filters applied, ordered still-to-play (scheduled and pending) → live →
 * done, by time when both have one, else round and match number.
 */
export function filterUpcomingMatches(
  allMatches: TournamentMatchForUmpire[],
  filters: UpcomingFilters,
): TournamentMatchForUmpire[] {
  const order = { upcoming: 0, live: 1, completed: 2 } as const;
  const priority = (s: string) => {
    const band = statusBand(s);
    return band ? order[band] : 3;
  };
  return allMatches
    .filter(m => inUpcomingList(m, filters))
    .sort((a, b) => {
      const pDiff = priority(a.status) - priority(b.status);
      if (pDiff !== 0) return pDiff;
      if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      return (a.round || 0) - (b.round || 0) || (a.match_number || 0) - (b.match_number || 0);
    });
}

/**
 * The number on each status pill: how many matches the list would show with
 * that pill picked and the other filters (search, format, court) unchanged.
 */
export function upcomingStatusCounts(
  allMatches: TournamentMatchForUmpire[],
  filters: UpcomingFilters,
): Record<UpcomingStatusFilter, number> {
  const counts: Record<UpcomingStatusFilter, number> = { ALL: 0, upcoming: 0, live: 0, completed: 0 };
  for (const m of allMatches) {
    if (!inUpcomingList(m, { ...filters, status: "ALL" })) continue;
    counts.ALL++;
    const band = statusBand(m.status);
    if (band) counts[band]++;
  }
  return counts;
}

/** Per-category progress for the "Select Format" cards. */
export function categoryProgress(matches: TournamentMatchForUmpire[], category: string) {
  const catMatches = matches.filter((m) => m.category === category);
  const upcoming = catMatches.filter((m) => m.status === "scheduled" || m.status === "pending").length;
  const inProgress = catMatches.filter((m) => m.status === "in_progress").length;
  const done = catMatches.filter((m) => m.status === "completed" || m.status === "walkover").length;
  return {
    total: catMatches.length,
    upcoming,
    inProgress,
    done,
    /** Every match is finished (nothing upcoming or live). */
    allDone: catMatches.length > 0 && upcoming === 0 && inProgress === 0,
  };
}

/**
 * Round headings for one category, Final first, then the 3rd place match,
 * then the semifinals and earlier rounds.
 */
export function orderRoundNames(matchesForCategory: Pick<TournamentMatchForUmpire, "round_name" | "round">[]): string[] {
  const roundEntries = [...new Set(matchesForCategory.map((m) => m.round_name))].map(name => {
    const maxRound = Math.max(...matchesForCategory.filter(m => m.round_name === name).map(m => m.round ?? 0));
    const is3rd = name.toLowerCase().includes('3rd');
    return { name, maxRound, is3rd };
  });
  roundEntries.sort((a, b) => {
    // 3rd place goes right after Final (highest round)
    if (a.is3rd && !b.is3rd) return b.maxRound === Math.max(...roundEntries.map(r => r.maxRound)) ? 1 : -1;
    if (b.is3rd && !a.is3rd) return a.maxRound === Math.max(...roundEntries.map(r => r.maxRound)) ? -1 : 1;
    return b.maxRound - a.maxRound;
  });
  return roundEntries.map(r => r.name);
}

export interface DirectSetInput {
  t1: string;
  t2: string;
}

export type DirectScoreResult =
  | { ok: true; winnerSide: 1 | 2; sets: string[]; score: string }
  | { ok: false; error: string };

/** The rules in words, shown above the "Enter Score" inputs: "First to 21 · 30 wins · best of 3". */
export function describeMatchRules(rules: MatchRules): string {
  const parts = [`First to ${rules.pointsToWin}`];
  if (rules.cap > rules.pointsToWin) parts.push(`${rules.cap} wins`);
  parts.push(`best of ${rules.bestOfSets}`);
  return parts.join(" · ");
}

const WHOLE_NUMBER = /^\d+$/;
const isBlankRow = (s: DirectSetInput) => s.t1.trim() === "" && s.t2.trim() === "";

/**
 * Validate the umpire's "Enter Score" form against the match's rules. Needs
 * at least as many games as it takes to win, no empty game before a filled
 * one, whole non-negative numbers in both boxes of every filled game, possible
 * badminton scores, nothing after the match was decided, and a decided match.
 */
export function validateDirectScore(directSets: DirectSetInput[], rules: MatchRules): DirectScoreResult {
  const needed = gamesToWin(rules.bestOfSets);
  const filledCount = directSets.filter(s => !isBlankRow(s)).length;
  if (filledCount < needed) {
    return { ok: false, error: `Enter at least ${needed} game${needed > 1 ? "s" : ""}` };
  }

  let lastFilled = directSets.length - 1;
  while (lastFilled >= 0 && isBlankRow(directSets[lastFilled])) lastFilled--;
  const rows = directSets.slice(0, lastFilled + 1);
  const gap = rows.findIndex(isBlankRow);
  if (gap >= 0) {
    return { ok: false, error: `Game ${gap + 1} is empty. Fill it in or clear the games after it.` };
  }

  if (rows.some(s => !WHOLE_NUMBER.test(s.t1.trim()) || !WHOLE_NUMBER.test(s.t2.trim()))) {
    return { ok: false, error: "All scores must be valid non-negative numbers" };
  }

  const games = rows.map(s => [Number(s.t1.trim()), Number(s.t2.trim())] as const);
  const checked = checkMatchScore(games, rules);
  if (checked.ok === false) return { ok: false, error: checked.error };
  if (!checked.complete) {
    return { ok: false, error: `Neither side has won ${needed} game${needed > 1 ? "s" : ""} yet.` };
  }

  const setsArr = games.map(([a, b]) => `${a}-${b}`);
  return { ok: true, winnerSide: checked.winnerSide, sets: setsArr, score: setsArr.join(", ") };
}

/**
 * Live preview under the "Enter Score" inputs: games won by each side among
 * the fully filled games, and the side ahead. Any impossible game in them
 * means no leader at all. `show` (the "Winner" line) is true only when the
 * form would save as it stands.
 */
export function directScorePreview(directSets: DirectSetInput[], rules: MatchRules) {
  const none = { leader: null as 1 | 2 | null, t1Wins: 0, t2Wins: 0, show: false };
  const filled = directSets.filter(s => s.t1.trim() !== "" && s.t2.trim() !== "");
  if (filled.some(s => !WHOLE_NUMBER.test(s.t1.trim()) || !WHOLE_NUMBER.test(s.t2.trim()))) return none;
  const checked = checkMatchScore(filled.map(s => [Number(s.t1.trim()), Number(s.t2.trim())] as const), rules);
  if (checked.ok === false) return none;
  const [t1Wins, t2Wins] = checked.gamesWon;
  const leader: 1 | 2 | null = t1Wins > t2Wins ? 1 : t2Wins > t1Wins ? 2 : null;
  return { leader, t1Wins, t2Wins, show: leader !== null && validateDirectScore(directSets, rules).ok };
}
