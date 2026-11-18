/**
 * Stored tournament point logs (plan items 6–7): decoding, per-game series
 * for the worm chart, and key moments. Pure functions only.
 *
 * Stored entry (see migration 20261115090000):
 *   [game, side (1|2, 0 = let/fault), t1, t2, server (1|2), ts_ms]
 */

export type CompactPoint = [number, number, number, number, number, number];

export interface Rally {
  game: number;
  /** Rally winner; lets and faults without a point are dropped. */
  side: 1 | 2;
  t1: number;
  t2: number;
  server: 1 | 2 | 0;
  ts: number;
}

export interface ScoringRules {
  pointsToWin: number; // 21
  goldenPoint: number; // 30 (score that wins outright)
  bestOf: number; // 3
}

export const DEFAULT_RULES: ScoringRules = { pointsToWin: 21, goldenPoint: 30, bestOf: 3 };

/** Decode stored entries, keeping only rallies that scored. Tolerates junk. */
export function decodePoints(raw: unknown): Rally[] {
  if (!Array.isArray(raw)) return [];
  const out: Rally[] = [];
  for (const e of raw) {
    if (!Array.isArray(e) || e.length < 4) continue;
    const [game, side, t1, t2, server, ts] = e.map((n) => Number(n));
    if (side !== 1 && side !== 2) continue;
    if (![game, t1, t2].every(Number.isFinite)) continue;
    out.push({ game, side, t1, t2, server: server === 1 || server === 2 ? server : 0, ts: Number.isFinite(ts) ? ts : 0 });
  }
  return out;
}

export interface GameSeries {
  game: number;
  rallies: Rally[];
  winner: 1 | 2 | null;
  final: [number, number];
}

/** Rallies grouped by game; the game winner is whoever led at its last rally (null if level). */
export function splitGames(rallies: Rally[]): GameSeries[] {
  const map = new Map<number, Rally[]>();
  for (const r of rallies) {
    const list = map.get(r.game) ?? [];
    list.push(r);
    map.set(r.game, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([game, list]) => {
      const last = list[list.length - 1];
      return {
        game,
        rallies: list,
        winner: last.t1 > last.t2 ? 1 : last.t2 > last.t1 ? 2 : null,
        final: [last.t1, last.t2],
      };
    });
}

/** Would winning the next rally win the game for side `s`? */
export function isGamePoint(mine: number, theirs: number, rules: ScoringRules): boolean {
  const next = mine + 1;
  if (next >= rules.goldenPoint) return true;
  return next >= rules.pointsToWin && next - theirs >= 2;
}

export function longestRun(rallies: Rally[]): { side: 1 | 2; length: number } | null {
  let best: { side: 1 | 2; length: number } | null = null;
  let cur = 0;
  let side: 1 | 2 | null = null;
  for (const r of rallies) {
    cur = r.side === side ? cur + 1 : 1;
    side = r.side;
    if (!best || cur > best.length) best = { side, length: cur };
  }
  return best;
}

export type MomentKind = "run" | "comeback" | "deuce" | "golden" | "game_points_saved" | "match_point";

export interface Moment {
  kind: MomentKind;
  game: number;
  side: 1 | 2 | null;
  text: string;
}

/**
 * Key moments, in match order: longest run per game (≥4), comebacks
 * (trailed by ≥5, then won the game), deuce and golden point, game points
 * saved, and the match point that ended it.
 */
export function keyMoments(rallies: Rally[], rules: ScoringRules = DEFAULT_RULES, names: [string, string] = ["Side 1", "Side 2"]): Moment[] {
  const games = splitGames(rallies);
  const moments: Moment[] = [];
  const won: [number, number] = [0, 0];
  const need = Math.floor(rules.bestOf / 2) + 1;
  const name = (s: 1 | 2) => names[s - 1];

  for (const g of games) {
    let prev: [number, number] = [0, 0];
    let maxDeficit: [number, number] = [0, 0];
    let deuce = false;
    let golden = false;
    const saved: [number, number] = [0, 0];
    let matchPointText: string | null = null;

    for (const r of g.rallies) {
      // Game/match point state *before* this rally.
      for (const s of [1, 2] as const) {
        const mine = prev[s - 1];
        const theirs = prev[2 - s];
        if (isGamePoint(mine, theirs, rules)) {
          const isMatchPoint = won[s - 1] === need - 1;
          if (r.side === s) {
            if (isMatchPoint) matchPointText = `${name(s)} converted match point at ${prev[0]}–${prev[1]}`;
          } else {
            saved[2 - s] += 1; // the other side saved it
          }
        }
      }
      const score: [number, number] = [r.t1, r.t2];
      maxDeficit = [Math.max(maxDeficit[0], score[1] - score[0]), Math.max(maxDeficit[1], score[0] - score[1])];
      if (score[0] >= rules.pointsToWin - 1 && score[1] >= rules.pointsToWin - 1) deuce = true;
      if (score[0] === rules.goldenPoint - 1 && score[1] === rules.goldenPoint - 1) golden = true;
      prev = score;
    }

    const run = longestRun(g.rallies);
    if (run && run.length >= 4) {
      moments.push({ kind: "run", game: g.game, side: run.side, text: `${name(run.side)} won ${run.length} rallies in a row` });
    }
    if (g.winner && maxDeficit[g.winner - 1] >= 5) {
      moments.push({
        kind: "comeback",
        game: g.game,
        side: g.winner,
        text: `${name(g.winner)} came back from ${maxDeficit[g.winner - 1]} points down to win the game`,
      });
    }
    if (golden) moments.push({ kind: "golden", game: g.game, side: null, text: `Golden point at ${rules.goldenPoint - 1}–${rules.goldenPoint - 1}` });
    else if (deuce) moments.push({ kind: "deuce", game: g.game, side: null, text: `Went to deuce` });
    for (const s of [1, 2] as const) {
      if (saved[s - 1] > 0) {
        moments.push({
          kind: "game_points_saved",
          game: g.game,
          side: s,
          text: `${name(s)} saved ${saved[s - 1]} game point${saved[s - 1] === 1 ? "" : "s"}`,
        });
      }
    }
    if (matchPointText && g.winner) moments.push({ kind: "match_point", game: g.game, side: g.winner, text: matchPointText });
    if (g.winner) won[g.winner - 1] += 1;
  }
  return moments;
}

/** Score after every `step` rallies, for the progression table. */
export function progression(g: GameSeries, step = 5): Array<{ rally: number; t1: number; t2: number }> {
  const out: Array<{ rally: number; t1: number; t2: number }> = [];
  g.rallies.forEach((r, i) => {
    if ((i + 1) % step === 0 || i === g.rallies.length - 1) out.push({ rally: i + 1, t1: r.t1, t2: r.t2 });
  });
  return out;
}

/** Game duration in minutes from rally timestamps, only when they look real (1–60 min). */
export function gameMinutes(g: GameSeries): number | null {
  const first = g.rallies[0]?.ts ?? 0;
  const last = g.rallies[g.rallies.length - 1]?.ts ?? 0;
  if (!first || !last || last <= first) return null;
  const mins = (last - first) / 60000;
  return mins >= 1 && mins <= 60 ? Math.round(mins) : null;
}
