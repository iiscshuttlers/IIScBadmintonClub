/**
 * "What's at stake" preview for a ranked tournament match. Mirrors the server
 * rating update (submit_tournament_match, migration 20261009105501):
 *   change = round(K * (actual - expected) * setsMult * tournamentMult)
 *   expected = 1 / (1 + 10^((opp - me) / 400)), side Elo = mean of the pair
 *   K = newbie K for < 10 completed matches, else experienced K
 *   setsMult = 1.2 for a 2-game result, 1.0 for 3 games
 * Because the game count isn't known in advance the result is a range.
 */

export interface EloConfig {
  kNewbie: number;
  kExperienced: number;
  tournamentMultiplier: number;
}

export const DEFAULT_ELO_CONFIG: EloConfig = { kNewbie: 40, kExperienced: 20, tournamentMultiplier: 1.5 };

export interface Stakes {
  /** [3-game result, 2-game result] — always min..max. */
  win: [number, number];
  lose: [number, number];
  expected: number;
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeStakes(
  myElo: number,
  partnerElo: number | null,
  oppElos: number[],
  myCompletedMatches: number,
  cfg: EloConfig = DEFAULT_ELO_CONFIG,
): Stakes {
  const mine = partnerElo != null ? (myElo + partnerElo) / 2 : myElo;
  const theirs = oppElos.length ? avg(oppElos) : 1200;
  const expected = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
  const k = myCompletedMatches < 10 ? cfg.kNewbie : cfg.kExperienced;
  const delta = (actual: number, setsMult: number) =>
    Math.round(k * (actual - expected) * setsMult * cfg.tournamentMultiplier);
  const w = [delta(1, 1.0), delta(1, 1.2)].sort((a, b) => a - b) as [number, number];
  const l = [delta(0, 1.2), delta(0, 1.0)].sort((a, b) => a - b) as [number, number];
  return { win: w, lose: l, expected };
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function formatRange([a, b]: [number, number]): string {
  return a === b ? signed(a) : `${signed(a)}…${signed(b)}`.replace(/…\+/, "…");
}
