import type { MatchView } from "@/lib/matchView";
import { matchFacts, type MatchFacts } from "@/lib/matchStats";

/**
 * Tournament stats (cricinfo series stats / FotMob top stats), computed from
 * completed and walkover matches only, so an in-progress score never becomes
 * a record. Plain JSON output. Pure.
 */

export interface MatchRef {
  id: string;
  tournamentId: string;
  title: string; // "Asha vs Bala"
  detail: string; // "MS · Final · 21–19, 22–20"
  value: number;
}

export interface LeaderRow {
  key: string; // player id, or sorted pair ids joined by "+"
  label: string;
  playerIds: string[];
  value: number;
  /** e.g. "5 of 6" */
  note?: string;
}

export interface TournamentStats {
  completed: number;
  walkovers: number;
  games: number;
  points: number;
  deuceGames: number;
  threeGameMatches: number;
  closest: MatchRef[];
  mostOneSided: MatchRef[];
  longestGame: MatchRef[];
  longestByTime: MatchRef[] | null; // null = timing not trustworthy
  timingCoverage: number; // 0..1 share of played matches with trusted durations
  mostWins: LeaderRow[];
  bestGameWinPct: LeaderRow[];
  seedUpsets: MatchRef[];
}

const MIN_MATCHES_FOR_PCT = 3;
const TOP = 3;

function ref(v: MatchView, value: number): MatchRef {
  const score = v.games.map((g) => `${g.side1}–${g.side2}`).join(", ");
  return {
    id: v.id,
    tournamentId: v.tournamentId,
    title: `${v.sides[0].label} vs ${v.sides[1].label}`,
    detail: [v.discipline ?? v.categoryLabel, v.roundName, score].filter(Boolean).join(" · "),
    value,
  };
}

/** All entries tied with the top `n` values (ties are all listed). */
function topWithTies<T>(items: T[], score: (t: T) => number, n = TOP, asc = false): T[] {
  const sorted = [...items].sort((a, b) => (asc ? score(a) - score(b) : score(b) - score(a)));
  if (sorted.length <= n) return sorted;
  const cut = score(sorted[n - 1]);
  return sorted.filter((t, i) => i < n || score(t) === cut);
}

function sideKey(ids: string[]): string {
  return [...ids].sort().join("+");
}

interface Competitor {
  key: string;
  label: string;
  ids: string[];
}

function getCompetitors(s: MatchView["sides"][0], isSpecificDoubles: boolean): Competitor[] {
  if (s.isBye || s.isTbd) return [];
  if (isSpecificDoubles) {
    if (s.playerIds.length === 0) {
      if (!s.label) return [];
      return [{ key: s.label.trim(), label: s.label.trim(), ids: [] }];
    }
    return [{ key: sideKey(s.playerIds), label: s.label, ids: [...s.playerIds] }];
  }

  // Individual players across the tournament
  if (s.playerIds.length > 1) {
    const names = s.label.split(/\s*&\s*|\s*\/\s*/).map((n) => n.trim());
    return s.playerIds.map((id, idx) => ({
      key: id,
      label: names[idx] || (idx === 0 ? names[0] : s.label),
      ids: [id],
    }));
  }

  if (s.playerIds.length === 1) {
    return [{ key: s.playerIds[0], label: s.label, ids: [s.playerIds[0]] }];
  }

  const names = s.label.split(/\s*&\s*|\s*\/\s*/).map((n) => n.trim()).filter(Boolean);
  return names.map((name) => ({
    key: name,
    label: name,
    ids: [],
  }));
}

export function computeTournamentStats(views: MatchView[]): TournamentStats {
  // Exclude BYEs from decided matches: a BYE is bracket advancement, not a match between players.
  const decided = views.filter(
    (v) => (v.state === "completed" || v.state === "walkover") && !v.sides.some((s) => s.isBye || /\bbye\b/i.test(s.label)),
  );
  const facts = new Map<string, MatchFacts>(decided.map((v) => [v.id, matchFacts(v)]));
  const played = decided.filter((v) => v.state === "completed" && v.games.length > 0);
  const f = (v: MatchView) => facts.get(v.id)!;

  const timed = played.filter((v) => f(v).durationMin != null);
  const timingCoverage = played.length ? timed.length / played.length : 0;

  const disciplines = new Set(views.map((v) => v.discipline).filter(Boolean));
  const isSpecificDoubles = disciplines.size === 1 && ["MD", "WD", "XD"].includes(Array.from(disciplines)[0]!);

  // Player / pair leaders (walkover wins count as wins; games only from played matches).
  const table = new Map<string, { label: string; ids: string[]; wins: number; matches: number; gw: number; gp: number }>();
  for (const v of decided) {
    const fx = f(v);
    v.sides.forEach((s, i) => {
      const comps = getCompetitors(s, isSpecificDoubles);
      for (const comp of comps) {
        const row = table.get(comp.key) ?? { label: comp.label, ids: comp.ids, wins: 0, matches: 0, gw: 0, gp: 0 };
        row.matches += 1;
        if (fx.winner === i) row.wins += 1;
        if (!fx.walkover) {
          for (const g of v.games) {
            row.gp += 1;
            if (i === 0 ? g.side1 > g.side2 : g.side2 > g.side1) row.gw += 1;
          }
        }
        table.set(comp.key, row);
      }
    });
  }
  const rows = Array.from(table.entries()).map(([key, r]) => ({ key, ...r }));

  const seedUpsets = decided
    .filter((v) => {
      const w = f(v).winner;
      if (w == null) return false;
      const ws = v.sides[w].seed;
      const ls = v.sides[w === 0 ? 1 : 0].seed;
      return ls != null && (ws == null || ws > ls);
    })
    .map((v) => {
      const w = f(v).winner!;
      const ws = v.sides[w].seed;
      const ls = v.sides[w === 0 ? 1 : 0].seed!;
      return ref(v, (ws ?? 99) - ls);
    });

  return {
    completed: decided.length,
    walkovers: decided.filter((v) => v.state === "walkover").length,
    games: played.reduce((n, v) => n + f(v).games, 0),
    points: played.reduce((n, v) => n + f(v).totalPoints, 0),
    deuceGames: played.reduce((n, v) => n + f(v).deuceGames, 0),
    threeGameMatches: played.filter((v) => f(v).games >= 3).length,
    closest: topWithTies(played, (v) => f(v).pointMargin, TOP, true).map((v) => ref(v, f(v).pointMargin)),
    mostOneSided: topWithTies(played, (v) => f(v).pointMargin).map((v) => ref(v, f(v).pointMargin)),
    longestGame: topWithTies(played, (v) => f(v).longestGamePoints).map((v) => ref(v, f(v).longestGamePoints)),
    longestByTime: timingCoverage >= 0.5 ? topWithTies(timed, (v) => f(v).durationMin!).map((v) => ref(v, f(v).durationMin!)) : null,
    timingCoverage,
    mostWins: topWithTies(rows.filter((r) => r.wins > 0), (r) => r.wins).map((r) => ({
      key: r.key,
      label: r.label,
      playerIds: r.ids,
      value: r.wins,
      note: `${r.wins} of ${r.matches}`,
    })),
    bestGameWinPct: topWithTies(
      rows.filter((r) => r.matches >= MIN_MATCHES_FOR_PCT && r.gp > 0),
      (r) => Math.round((r.gw / r.gp) * 100),
    ).map((r) => ({
      key: r.key,
      label: r.label,
      playerIds: r.ids,
      value: Math.round((r.gw / r.gp) * 100),
      note: `${r.gw} of ${r.gp} games`,
    })),
    seedUpsets: topWithTies(seedUpsets, (r) => r.value).slice(0, 5),
  };
}
