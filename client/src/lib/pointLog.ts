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
  if (rules.goldenPoint > 0 && next >= rules.goldenPoint) return true;
  return next >= rules.pointsToWin && next - theirs >= 2;
}

export type PointLogCoverage = "complete" | "live" | "partial" | "corrected";

export interface ExpectedGameScore {
  side1: number;
  side2: number;
}

/**
 * Classify how much of the displayed score is supported by the stored log.
 * A matching final score is not sufficient: every scoring rally must advance
 * exactly one side by one point, otherwise an omitted part of the history
 * could be presented as a complete timeline.
 */
export function assessPointLogCoverage(
  rallies: Rally[],
  expectedGames: ExpectedGameScore[],
  options: {
    finished: boolean;
    final: boolean;
    supersededByCorrection: boolean;
    storedEntryCountMatches?: boolean;
  },
): PointLogCoverage {
  if (options.supersededByCorrection) return "corrected";
  if (rallies.length === 0 || expectedGames.length === 0 || options.storedEntryCountMatches === false) return "partial";

  const games = splitGames(rallies);
  if (games.length !== expectedGames.length) return "partial";

  for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
    const game = games[gameIndex];
    const expected = expectedGames[gameIndex];
    if (game.game !== gameIndex + 1 || game.final[0] !== expected.side1 || game.final[1] !== expected.side2) return "partial";

    let previous: [number, number] = [0, 0];
    for (const rally of game.rallies) {
      const delta1 = rally.t1 - previous[0];
      const delta2 = rally.t2 - previous[1];
      if ((rally.side === 1 && (delta1 !== 1 || delta2 !== 0)) || (rally.side === 2 && (delta1 !== 0 || delta2 !== 1))) {
        return "partial";
      }
      previous = [rally.t1, rally.t2];
    }
  }

  if (options.finished) return options.final ? "complete" : "partial";
  return options.final ? "partial" : "live";
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
            if (isMatchPoint) matchPointText = `${name(s)} won on match point at ${prev[0]}–${prev[1]}`;
          } else {
            saved[2 - s] += 1; // the other side saved it
          }
        }
      }
      const score: [number, number] = [r.t1, r.t2];
      maxDeficit = [Math.max(maxDeficit[0], score[1] - score[0]), Math.max(maxDeficit[1], score[0] - score[1])];
      if (score[0] >= rules.pointsToWin - 1 && score[1] >= rules.pointsToWin - 1) deuce = true;
      if (rules.goldenPoint > 0 && score[0] === rules.goldenPoint - 1 && score[1] === rules.goldenPoint - 1) golden = true;
      prev = score;
    }

    const run = longestRun(g.rallies);
    if (run && run.length >= 4) {
      moments.push({ kind: "run", game: g.game, side: run.side, text: `${name(run.side)} won ${run.length} points in a row` });
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

// ── Per-side stats (Stats tab) ─────────────────────────────────────────────

/** First usable word of a name: skips initials such as "K." or "S". */
function firstName(person: string): string {
  const words = person.trim().split(/\s+/).filter(Boolean);
  return words.find((w) => w.replace(/[^\p{L}]/gu, "").length >= 3) ?? words[0] ?? "";
}

/**
 * Short names for charts and takeaways: "Shiv Pratap Singh Rathore" → "Shiv",
 * "Ritul & Prasenjeet Padhi" → "Ritul & Prasenjeet". Keeps the full labels
 * when the short ones would read the same for both sides.
 */
export function shortNames(labels: [string, string]): [string, string] {
  const one = (label: string) =>
    label
      .split(/\s*(?:&|\/|\+|,)\s*|\s+and\s+/i)
      .map(firstName)
      .filter(Boolean)
      .join(" & ") || label;
  const s: [string, string] = [one(labels[0]), one(labels[1])];
  return s[0].toLowerCase() === s[1].toLowerCase() ? labels : s;
}

/**
 * Who served each rally. The umpire screen stores the side that serves
 * *next* (the rally winner), so a rally's server is the winner of the rally
 * before it; across games this also holds (the game winner serves first).
 * The match's first serve isn't stored, so it is null.
 */
export function rallyServers(rallies: Rally[]): Array<1 | 2 | null> {
  return rallies.map((_, i) => (i === 0 ? null : rallies[i - 1].side));
}

/** The side serving the next rally: whoever won the last one. */
export function nextServer(rallies: Rally[]): 1 | 2 | null {
  return rallies.length > 0 ? rallies[rallies.length - 1].side : null;
}

export interface Tally {
  won: number;
  of: number;
}

export interface SideStats {
  pointsWon: number;
  /** Most points in a row within one game. */
  longestRun: number;
  biggestLead: number;
  /** Rallies after which this side was ahead. */
  ralliesAhead: number;
  /** Rallies this side played at game point (match points included). */
  gamePoints: Tally;
  /** Rallies this side served, and how many it won. */
  onServe: Tally;
  /** Rallies the other side served, and how many this side won. */
  onReceive: Tally;
  /** Rallies from `crunchFrom`-all on (18–18 in a game to 21). */
  crunch: Tally;
}

export interface RallyStats {
  rallies: number;
  sides: [SideStats, SideStats];
  /** Times the leader switched (level scores in between don't count). */
  leadChanges: number;
  /** Times the score was level after a rally. */
  ties: number;
  crunchFrom: number;
}

function blankSide(): SideStats {
  return {
    pointsWon: 0,
    longestRun: 0,
    biggestLead: 0,
    ralliesAhead: 0,
    gamePoints: { won: 0, of: 0 },
    onServe: { won: 0, of: 0 },
    onReceive: { won: 0, of: 0 },
    crunch: { won: 0, of: 0 },
  };
}

/**
 * Both sides' numbers for the whole match (`game` null) or one game. Takes
 * every rally of the match even for one game, because a game's first server
 * comes from the game before it.
 */
export function rallyStats(rallies: Rally[], rules: ScoringRules = DEFAULT_RULES, game: number | null = null): RallyStats {
  const servers = rallyServers(rallies);
  const crunchFrom = Math.max(0, rules.pointsToWin - 3);
  const sides: [SideStats, SideStats] = [blankSide(), blankSide()];
  let count = 0;
  let leadChanges = 0;
  let ties = 0;
  let curGame: number | null = null;
  let runSide: 1 | 2 | null = null;
  let run = 0;
  let leader: 0 | 1 | 2 = 0;

  rallies.forEach((r, i) => {
    if (game != null && r.game !== game) return;
    if (r.game !== curGame) {
      curGame = r.game;
      runSide = null;
      run = 0;
      leader = 0;
    }
    count += 1;
    const s = r.side;
    const me = sides[s - 1];
    me.pointsWon += 1;
    run = runSide === s ? run + 1 : 1;
    runSide = s;
    me.longestRun = Math.max(me.longestRun, run);

    const before: [number, number] = [r.t1 - (s === 1 ? 1 : 0), r.t2 - (s === 2 ? 1 : 0)];
    for (const k of [1, 2] as const) {
      if (isGamePoint(before[k - 1], before[2 - k], rules)) {
        sides[k - 1].gamePoints.of += 1;
        if (s === k) sides[k - 1].gamePoints.won += 1;
      }
    }
    if (before[0] >= crunchFrom && before[1] >= crunchFrom) {
      sides[0].crunch.of += 1;
      sides[1].crunch.of += 1;
      me.crunch.won += 1;
    }

    const diff = r.t1 - r.t2;
    if (diff === 0) {
      ties += 1;
    } else {
      const ahead: 1 | 2 = diff > 0 ? 1 : 2;
      const a = sides[ahead - 1];
      a.ralliesAhead += 1;
      a.biggestLead = Math.max(a.biggestLead, Math.abs(diff));
      if (leader !== 0 && leader !== ahead) leadChanges += 1;
      leader = ahead;
    }

    const server = servers[i];
    if (server) {
      const receiver: 1 | 2 = server === 1 ? 2 : 1;
      sides[server - 1].onServe.of += 1;
      sides[receiver - 1].onReceive.of += 1;
      if (s === server) sides[server - 1].onServe.won += 1;
      else sides[receiver - 1].onReceive.won += 1;
    }
  });

  return { rallies: count, sides, leadChanges, ties, crunchFrom };
}

export interface GameFlow {
  game: number;
  final: [number, number];
  winner: 1 | 2 | null;
  /** Score when the first side reached the interval (11 in a game to 21). */
  atInterval: [number, number] | null;
  leadChanges: number;
  longestRun: { side: 1 | 2; length: number } | null;
  minutes: number | null;
}

/** One row per game for the game-by-game table. */
export function gameFlows(rallies: Rally[], rules: ScoringRules = DEFAULT_RULES): GameFlow[] {
  const intervalPoint = Math.ceil(rules.pointsToWin / 2);
  return splitGames(rallies).map((g) => {
    const atI = g.rallies.find((r) => r.t1 === intervalPoint || r.t2 === intervalPoint);
    return {
      game: g.game,
      final: g.final,
      winner: g.winner,
      atInterval: atI ? [atI.t1, atI.t2] : null,
      leadChanges: rallyStats(g.rallies, rules).leadChanges,
      longestRun: longestRun(g.rallies),
      minutes: gameMinutes(g),
    };
  });
}

const pct = (t: Tally) => (t.of > 0 ? Math.round((t.won / t.of) * 100) : 0);

/**
 * Plain-English takeaways for players, most telling first (at most `max`).
 * Each needs enough rallies behind it to mean something; names only, no
 * pronouns. `matchWinner` is the side that won the match, when decided.
 */
export function statInsights(
  stats: RallyStats,
  names: [string, string],
  opts: { scope: "match" | "game"; matchWinner?: 1 | 2 | null; max?: number } = { scope: "match" },
): string[] {
  const [a, b] = stats.sides;
  const where = opts.scope === "match" ? "the match" : "this game";
  const out: Array<{ weight: number; text: string }> = [];
  const total = stats.rallies;
  if (total < 6) return [];

  // More points but lost: the most surprising thing a scoreline hides.
  if (opts.scope === "match" && opts.matchWinner) {
    const w = opts.matchWinner - 1;
    const l = 1 - w;
    if (stats.sides[l].pointsWon > stats.sides[w].pointsWon) {
      out.push({
        weight: 100,
        text: `${names[l]} won more points (${stats.sides[l].pointsWon}–${stats.sides[w].pointsWon}), but ${names[w]} won the match.`,
      });
    }
  }

  // Who controlled it.
  for (const k of [0, 1] as const) {
    const other = 1 - k;
    const share = stats.sides[k].ralliesAhead / total;
    if (stats.sides[other].ralliesAhead === 0 && stats.sides[k].ralliesAhead > 0) {
      out.push({ weight: 90, text: `${names[k]} never trailed in ${where}.` });
    } else if (share >= 0.6) {
      out.push({ weight: 60 + share * 20, text: `${names[k]} led for ${Math.round(share * 100)}% of ${where}.` });
    }
  }
  if (stats.leadChanges >= 4) {
    out.push({ weight: 55 + stats.leadChanges, text: `The lead changed ${stats.leadChanges} times.` });
  }

  // Serve: who made more of their own serve.
  if (a.onServe.of >= 8 && b.onServe.of >= 8) {
    const pa = pct(a.onServe);
    const pb = pct(b.onServe);
    if (Math.abs(pa - pb) >= 8) {
      const [hi, lo, phi, plo] = pa > pb ? [0, 1, pa, pb] : [1, 0, pb, pa];
      out.push({
        weight: 50 + (phi - plo),
        text: `On serve, ${names[hi]} won ${phi}% of points and ${names[lo]} ${plo}%.`,
      });
    }
  }

  // Crunch time.
  const crunch = a.crunch.of;
  if (crunch >= 3) {
    const hi = a.crunch.won >= b.crunch.won ? 0 : 1;
    const won = stats.sides[hi].crunch.won;
    if (won / crunch >= 0.6) {
      out.push({
        weight: 70,
        text: `From ${stats.crunchFrom}-all, ${names[hi]} won ${won} of ${crunch} points.`,
      });
    }
  }

  // Game points left on the table.
  for (const k of [0, 1] as const) {
    const gp = stats.sides[k].gamePoints;
    const missed = gp.of - gp.won;
    if (missed >= 2) {
      out.push({
        weight: 45 + missed * 5,
        text: gp.won === 0 ? `${names[k]} had ${gp.of} game points but won none.` : `${names[k]} won ${gp.won} of ${gp.of} game points.`,
      });
    }
  }

  // Runs.
  if (Math.abs(a.longestRun - b.longestRun) >= 3) {
    const k = a.longestRun > b.longestRun ? 0 : 1;
    out.push({
      weight: 40 + stats.sides[k].longestRun,
      text: `Best run: ${names[k]} ${stats.sides[k].longestRun} points in a row, ${names[1 - k]} ${stats.sides[1 - k].longestRun}.`,
    });
  }

  return out
    .sort((x, y) => y.weight - x.weight)
    .slice(0, opts.max ?? 4)
    .map((x) => x.text);
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
