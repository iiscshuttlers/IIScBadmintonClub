/**
 * Pure logic behind the umpire's tournament tab: the format → category →
 * match drill-down, queue ordering, rule enrichment, list filters and the
 * "Enter Score" validation. Kept free of React so it can be tested directly.
 */
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";

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

/** Umpire queue order: live first, then everything still to play, then done; then by round and match number. */
export function compareUmpireQueue(a: QueueMatch, b: QueueMatch): number {
  const priority = (s: string) => {
    if (s === "in_progress") return 0;
    if (s === "completed" || s === "walkover") return 2;
    return 1;
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

/** A side reads BYE (any label containing "BYE", case-insensitive). Used to hide byes from the queue. */
export function hasByeSide(m: LabelledMatch): boolean {
  const t1 = m.team1_label;
  const t2 = m.team2_label;
  return Boolean(t1 === "BYE" || t2 === "BYE" || t1?.toUpperCase().includes("BYE") || t2?.toUpperCase().includes("BYE"));
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
 * The umpire's match list: byes dropped, status filter applied, ordered
 * scheduled → live → rest (by time when both have one, else round and match
 * number), then narrowed by search, format and court.
 */
export function filterUpcomingMatches(
  allMatches: TournamentMatchForUmpire[],
  filters: UpcomingFilters,
): TournamentMatchForUmpire[] {
  let upcomingScheduled = allMatches
    .filter(m => !hasByeSide(m))
    .filter(m => {
      if (filters.status === "upcoming") return m.status === "scheduled" || m.status === "pending";
      if (filters.status === "live") return m.status === "in_progress";
      if (filters.status === "completed") return m.status === "completed" || m.status === "walkover";
      return true;
    })
    .sort((a, b) => {
      const priority = (s: string) => s === "scheduled" ? 0 : s === "in_progress" ? 1 : 2;
      const pDiff = priority(a.status) - priority(b.status);
      if (pDiff !== 0) return pDiff;
      if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      return (a.round || 0) - (b.round || 0) || (a.match_number || 0) - (b.match_number || 0);
    });

  if (filters.search.trim()) {
    const lowerQ = filters.search.toLowerCase();
    upcomingScheduled = upcomingScheduled.filter(m =>
      (m.team1_label?.toLowerCase() || "").includes(lowerQ) ||
      (m.team2_label?.toLowerCase() || "").includes(lowerQ) ||
      (m.match_code?.toLowerCase() || "").includes(lowerQ) ||
      (m.court_number?.toLowerCase() || "").includes(lowerQ)
    );
  }
  if (filters.format !== "ALL") {
    upcomingScheduled = upcomingScheduled.filter(m => m.category === filters.format);
  }
  if (filters.court !== "ALL") {
    upcomingScheduled = upcomingScheduled.filter(m => m.court_number === filters.court);
  }
  return upcomingScheduled;
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

/**
 * Validate the umpire's "Enter Score" form. Needs at least 2 sets (1 for a
 * best-of-1), whole non-negative numbers, no tied set and a clear set
 * majority; the side with more sets wins.
 */
export function validateDirectScore(directSets: DirectSetInput[], bestOfSets: number | null | undefined): DirectScoreResult {
  const filledSets = directSets.filter(s => s.t1.trim() !== "" || s.t2.trim() !== "");
  const minSets = (bestOfSets ?? 3) === 1 ? 1 : 2;
  if (filledSets.length < minSets) {
    return { ok: false, error: `Enter at least ${minSets} set${minSets > 1 ? "s" : ""}` };
  }

  const parsed = filledSets.map(s => ({
    t1: parseInt(s.t1, 10),
    t2: parseInt(s.t2, 10),
  }));

  if (parsed.some(s => isNaN(s.t1) || isNaN(s.t2) || s.t1 < 0 || s.t2 < 0)) {
    return { ok: false, error: "All scores must be valid non-negative numbers" };
  }

  const t1Wins = parsed.filter(s => s.t1 > s.t2).length;
  const t2Wins = parsed.filter(s => s.t2 > s.t1).length;
  if (t1Wins === t2Wins) {
    return { ok: false, error: "Scores must produce a winner — tied set count" };
  }
  if (parsed.some(s => s.t1 === s.t2)) {
    return { ok: false, error: "A set cannot be tied" };
  }

  const winnerSide: 1 | 2 = t1Wins > t2Wins ? 1 : 2;
  const setsArr = parsed.map(s => `${s.t1}-${s.t2}`);
  return { ok: true, winnerSide, sets: setsArr, score: setsArr.join(", ") };
}

/**
 * Live preview under the "Enter Score" inputs: the side ahead on sets among
 * fully filled, untied sets. `show` is false until two such sets exist.
 */
export function directScorePreview(directSets: DirectSetInput[]) {
  const filled = directSets.filter(s => s.t1.trim() !== "" && s.t2.trim() !== "");
  const parsed = filled.map(s => ({ t1: parseInt(s.t1, 10), t2: parseInt(s.t2, 10) }));
  const valid = parsed.filter(s => !isNaN(s.t1) && !isNaN(s.t2) && s.t1 !== s.t2);
  const t1Wins = valid.filter(s => s.t1 > s.t2).length;
  const t2Wins = valid.filter(s => s.t2 > s.t1).length;
  const leader: 1 | 2 | null = t1Wins > t2Wins ? 1 : t2Wins > t1Wins ? 2 : null;
  return { leader, t1Wins, t2Wins, show: leader !== null && valid.length >= 2 };
}
