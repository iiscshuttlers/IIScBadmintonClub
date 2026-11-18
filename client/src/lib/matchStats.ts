import type { MatchView } from "@/lib/matchView";

/**
 * Per-match facts shared by the tournament Stats tab and the all-time
 * records book (plan items 8–9). Pure.
 */

export interface MatchFacts {
  id: string;
  tournamentId: string;
  walkover: boolean;
  /**
   * Loser scored no points at all (e.g. 0–21, 0–21 or 0–30): a forfeit entered
   * as a score. Counts as a win, but not in score-based records or upsets.
   */
  conceded: boolean;
  /** Winning side index (0/1), or null when undecided. */
  winner: 0 | 1 | null;
  games: number;
  totalPoints: number;
  /** Sum over games of |side1 − side2|; smaller = closer. */
  pointMargin: number;
  /** Games that reached 20–20 (or ran past 21). */
  deuceGames: number;
  /** Most points in a single game (both sides). */
  longestGamePoints: number;
  /** Minutes, only when timing can be trusted; else null. */
  durationMin: number | null;
}

export const MIN_TRUSTED_MIN = 10;
export const MAX_TRUSTED_MIN = 120;

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Duration only when trustworthy: both stamps present, 10–120 minutes, and
 * ending on the same local day it started. Some matches were closed in bulk
 * after the event (e.g. finals "finished" the next morning), so anything else
 * is treated as unknown rather than reported.
 */
export function trustedDurationMin(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const s = Date.parse(startedAt);
  const e = Date.parse(endedAt);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const min = (e - s) / 60000;
  if (min < MIN_TRUSTED_MIN || min > MAX_TRUSTED_MIN) return null;
  if (localDay(startedAt) !== localDay(endedAt)) return null;
  return Math.round(min);
}

/**
 * A game went to deuce when both sides reached `target − 1` (20–20 in a
 * 21-point game, 29–29 in a 30-point single game, where the next point
 * decides it). Unknown target → 21. A 21-point game can still end 30–29 or
 * 30–28 and that is a deuce; a 30-point game ending 30–15 is not.
 */
export function isDeuceGame(side1: number, side2: number, target = 21): boolean {
  const t = Number.isFinite(target) && target > 1 ? target : 21;
  return Math.min(side1, side2) >= t - 1;
}

export function matchFacts(v: MatchView): MatchFacts {
  const walkover = v.state === "walkover";
  const games = walkover ? [] : v.games;
  const winner = v.sides[0].isWinner ? 0 : v.sides[1].isWinner ? 1 : null;
  return {
    id: v.id,
    tournamentId: v.tournamentId,
    walkover,
    conceded:
      !walkover &&
      winner != null &&
      games.length > 0 &&
      games.reduce((n, g) => n + (winner === 0 ? g.side2 : g.side1), 0) === 0,
    winner,
    games: games.length,
    totalPoints: games.reduce((n, g) => n + g.side1 + g.side2, 0),
    pointMargin: games.reduce((n, g) => n + Math.abs(g.side1 - g.side2), 0),
    deuceGames: games.filter((g) => isDeuceGame(g.side1, g.side2, v.pointsToWin ?? 21)).length,
    longestGamePoints: games.reduce((m, g) => Math.max(m, g.side1 + g.side2), 0),
    durationMin: walkover ? null : trustedDurationMin(v.startedAt, v.endedAt),
  };
}
