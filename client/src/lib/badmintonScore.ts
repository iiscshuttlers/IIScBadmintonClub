/**
 * Badminton score rules shared by every screen that records a result
 * (admin score editor, umpire "Enter Score"). Pure: no React, no Supabase.
 *
 * A game is won by reaching `pointsToWin` with a 2-point lead; from deuce the
 * lead must be exactly 2, until `cap` (the golden point), where 1 or 2 wins.
 * When the cap equals the game length (30-point games capped at 30, as most
 * club rounds are), there is no deuce: at 29-29 the next point wins.
 * A match is won by the first side to take a majority of `bestOfSets` games.
 */

export interface MatchRules {
  bestOfSets: number;
  pointsToWin: number;
  /** Golden point: the score at which the next point wins (30 for a 21-point game). */
  cap: number;
}

/**
 * The cap used when a match row has no golden_point of its own: 30, or the
 * game length if that is higher. Lenient on purpose, as the editors always
 * were: it never refuses a real score.
 */
export function defaultCap(pointsToWin: number): number {
  return Math.max(30, pointsToWin);
}

/** Rules for a match row, falling back to 3 games of 21 with a cap of 30. */
export function matchRules(row: {
  best_of_sets?: number | null;
  points_to_win?: number | null;
  golden_point?: number | null;
}): MatchRules {
  const pointsToWin = row.points_to_win ?? 21;
  return {
    bestOfSets: row.best_of_sets ?? 3,
    pointsToWin,
    cap: row.golden_point ?? defaultCap(pointsToWin),
  };
}

/** Games needed to win the match (2 of 3, 1 of 1, 3 of 5). */
export function gamesToWin(bestOfSets: number): number {
  return Math.floor(Math.max(1, bestOfSets) / 2) + 1;
}

/** A finished game under the rules above (either side may be the winner). */
export function isValidBadmintonGame(t1: number, t2: number, pointsToWin: number, cap: number): boolean {
  if (!Number.isInteger(t1) || !Number.isInteger(t2) || t1 < 0 || t2 < 0) return false;
  const win = Math.max(t1, t2);
  const lose = Math.min(t1, t2);
  const lead = win - lose;
  if (win === pointsToWin && lead >= 2) return true;
  if (win > pointsToWin && win < cap && lead === 2) return true;
  // At the cap the next point wins, so a 1-point lead is enough there; this
  // includes cap === pointsToWin (30-29 in a 30-point game capped at 30).
  if (win === cap && cap >= pointsToWin && (lead === 1 || lead === 2)) return true;
  return false;
}

export type Game = readonly [number, number];

export type MatchScoreCheck =
  | { ok: true; complete: true; winnerSide: 1 | 2; gamesWon: [number, number] }
  | { ok: true; complete: false; winnerSide: null; gamesWon: [number, number] }
  | { ok: false; error: string };

/**
 * Check a list of finished games against the rules: every game is a possible
 * badminton score, there are no more games than the format allows, and no game
 * comes after one side has already won. `complete` says whether a side has won.
 */
export function checkMatchScore(games: readonly Game[], rules: MatchRules): MatchScoreCheck {
  const needed = gamesToWin(rules.bestOfSets);
  if (games.length > rules.bestOfSets) {
    return { ok: false, error: `A best-of-${rules.bestOfSets} match has at most ${rules.bestOfSets} game${rules.bestOfSets === 1 ? "" : "s"}.` };
  }
  const won: [number, number] = [0, 0];
  for (let i = 0; i < games.length; i++) {
    const [a, b] = games[i];
    if (won[0] >= needed || won[1] >= needed) {
      return { ok: false, error: `The match was already won after game ${i}. Remove game ${i + 1}.` };
    }
    if (!isValidBadmintonGame(a, b, rules.pointsToWin, rules.cap)) {
      return {
        ok: false,
        error: `Game ${i + 1}: ${a}-${b} isn't a possible score (first to ${rules.pointsToWin}, win by 2, ${rules.cap} wins).`,
      };
    }
    won[a > b ? 0 : 1]++;
  }
  if (won[0] >= needed) return { ok: true, complete: true, winnerSide: 1, gamesWon: won };
  if (won[1] >= needed) return { ok: true, complete: true, winnerSide: 2, gamesWon: won };
  return { ok: true, complete: false, winnerSide: null, gamesWon: won };
}
