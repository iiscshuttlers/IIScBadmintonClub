import type { Discipline } from "@/lib/tournamentRoutes";
import type { MatchSide, MatchView } from "@/lib/matchView";
import { matchFacts } from "@/lib/matchStats";

/**
 * All-time club records (cricinfo Statsguru style, plan item 9), from decided
 * tournament matches. Pure; plain JSON output. Ties for a record are all listed.
 *
 * Scope (owner decision 4): all published, completed tournaments by default;
 * `rankedOnly` keeps tournaments that counted for Elo. Friendly matches never
 * reach this code (tournament_matches only); cancelled matches are excluded.
 */

export interface RecordTournament {
  id: string;
  name: string;
  countsForElo: boolean;
}

export interface PlayerRecordRow {
  playerId: string;
  name: string;
  value: number;
  note?: string;
}

export interface MatchRecordRow {
  matchId: string;
  tournamentId: string;
  title: string;
  /** Side labels in title order, so the winner can be styled apart. */
  sides: [string, string];
  /** Index into `sides` of the winner, or null when undecided. */
  winner: 0 | 1 | null;
  detail: string;
  value: number;
}

export interface ClubRecords {
  matchCount: number;
  tournamentCount: number;
  mostTitles: PlayerRecordRow[];
  mostFinals: PlayerRecordRow[];
  mostWins: PlayerRecordRow[];
  longestStreak: PlayerRecordRow[];
  longestGame: MatchRecordRow[];
  closestFinal: MatchRecordRow[];
}

const isThirdPlace = (v: MatchView) => /3rd|third/i.test(v.roundName) || /_3RD_/i.test(v.matchCode ?? "");
/** Same rule as lib/myCertificates. */
export const isFinal = (v: MatchView) =>
  !isThirdPlace(v) && (/(^|\s)(grand\s+)?final$/i.test(v.roundName.trim()) || /_F_\d+$/i.test(v.matchCode ?? ""));

function people(side: MatchSide): Array<{ id: string; name: string }> {
  const names = side.label.split(/\s+(?:\/|&)\s+|\s*,\s*/).map((n) => n.trim()).filter(Boolean);
  return side.playerIds.map((id, i) => ({
    id,
    name: names.length === side.playerIds.length ? names[i] : side.playerIds.length === 1 ? side.label : side.label,
  }));
}

function top<T>(items: T[], score: (t: T) => number, n = 5, asc = false): T[] {
  const sorted = [...items].sort((a, b) => (asc ? score(a) - score(b) : score(b) - score(a)));
  if (sorted.length <= n) return sorted;
  const cut = score(sorted[n - 1]);
  return sorted.filter((t, i) => i < n || score(t) === cut);
}

const when = (v: MatchView) => Date.parse(v.endedAt ?? v.scheduledAt ?? "") || 0;

export function computeClubRecords(
  views: MatchView[],
  tournaments: Record<string, RecordTournament>,
  opts: { discipline?: Discipline | null; rankedOnly?: boolean; names?: Record<string, string> } = {},
): ClubRecords {
  const nameOf = (p: { id: string; name: string }) => ({ id: p.id, name: opts.names?.[p.id] ?? p.name });
  const decided = views.filter(
    (v) =>
      (v.state === "completed" || v.state === "walkover") &&
      !!tournaments[v.tournamentId] &&
      (!opts.rankedOnly || tournaments[v.tournamentId].countsForElo) &&
      (!opts.discipline || v.discipline === opts.discipline) &&
      v.sides.some((s) => s.isWinner),
  );

  const tally = new Map<string, { name: string; titles: number; finals: number; wins: number; matches: number }>();
  const bump = (p: { id: string; name: string }) => {
    const t = tally.get(p.id) ?? { name: p.name, titles: 0, finals: 0, wins: 0, matches: 0 };
    tally.set(p.id, t);
    return t;
  };

  // Streaks need chronological order per player.
  const timeline = new Map<string, Array<{ t: number; won: boolean }>>();

  for (const v of decided) {
    const final = isFinal(v);
    v.sides.forEach((s) => {
      if (s.isBye) return;
      for (const p of people(s).map(nameOf)) {
        const t = bump(p);
        t.matches += 1;
        if (s.isWinner) t.wins += 1;
        if (final) {
          t.finals += 1;
          if (s.isWinner) t.titles += 1;
        }
        const list = timeline.get(p.id) ?? [];
        list.push({ t: when(v), won: s.isWinner });
        timeline.set(p.id, list);
      }
    });
  }

  const players = Array.from(tally.entries()).map(([playerId, t]) => ({ playerId, ...t }));
  const streaks = Array.from(timeline.entries()).map(([playerId, list]) => {
    let best = 0;
    let cur = 0;
    for (const r of [...list].sort((a, b) => a.t - b.t)) {
      cur = r.won ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return { playerId, name: tally.get(playerId)!.name, value: best };
  });

  const played = decided.filter((v) => v.state === "completed" && v.games.length > 0);
  const label = (v: MatchView) => `${v.sides[0].label} vs ${v.sides[1].label}`;
  const sidesOf = (v: MatchView) => ({
    sides: [v.sides[0].label, v.sides[1].label] as [string, string],
    winner: v.sides[0].isWinner ? (0 as const) : v.sides[1].isWinner ? (1 as const) : null,
  });
  const detail = (v: MatchView) =>
    [tournaments[v.tournamentId]?.name, v.discipline ?? v.categoryLabel, v.roundName, v.games.map((g) => `${g.side1}–${g.side2}`).join(", ")]
      .filter(Boolean)
      .join(" · ");

  return {
    matchCount: decided.length,
    tournamentCount: new Set(decided.map((v) => v.tournamentId)).size,
    mostTitles: top(players.filter((p) => p.titles > 0), (p) => p.titles).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      value: p.titles,
      note: `${p.finals} ${p.finals === 1 ? "final" : "finals"}`,
    })),
    mostFinals: top(players.filter((p) => p.finals > 0), (p) => p.finals).map((p) => ({ playerId: p.playerId, name: p.name, value: p.finals })),
    mostWins: top(players.filter((p) => p.wins > 0), (p) => p.wins).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      value: p.wins,
      note: `of ${p.matches} matches`,
    })),
    longestStreak: top(streaks.filter((s) => s.value >= 2), (s) => s.value),
    longestGame: top(played, (v) => matchFacts(v).longestGamePoints, 3).map((v) => ({
      matchId: v.id,
      tournamentId: v.tournamentId,
      title: label(v),
      ...sidesOf(v),
      detail: detail(v),
      value: matchFacts(v).longestGamePoints,
    })),
    closestFinal: top(played.filter(isFinal), (v) => matchFacts(v).pointMargin, 3, true).map((v) => ({
      matchId: v.id,
      tournamentId: v.tournamentId,
      title: label(v),
      ...sidesOf(v),
      detail: detail(v),
      value: matchFacts(v).pointMargin,
    })),
  };
}
