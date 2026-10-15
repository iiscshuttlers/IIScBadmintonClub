/** Head-to-head + recent form between two sides, from tournament match history. */

export interface HistMatch {
  id: string;
  status: string;
  winner_side: number | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  score?: string | null;
  ended_at?: string | null;
  scheduled_at?: string | null;
  category?: string | null;
  tournaments?: { name?: string | null } | null;
}

const side = (m: HistMatch, s: 1 | 2) =>
  (s === 1 ? [m.player1_id, m.player3_id] : [m.player2_id, m.player4_id]).filter((x): x is string => !!x);
const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));
const when = (m: HistMatch) => m.ended_at || m.scheduled_at || "";
const finished = (m: HistMatch) => (m.status === "completed" || m.status === "walkover") && !!m.winner_side;

export interface H2H {
  aWins: number;
  bWins: number;
  meetings: { id: string; aWon: boolean; score: string | null; date: string; where: string | null }[];
}

/** Meetings where one side contains any of `a` and the other any of `b`. */
export function headToHead(history: HistMatch[], a: string[], b: string[]): H2H {
  const meetings = history
    .filter(finished)
    .flatMap((m) => {
      const s1 = side(m, 1);
      const s2 = side(m, 2);
      const aSide = overlaps(s1, a) && overlaps(s2, b) ? 1 : overlaps(s2, a) && overlaps(s1, b) ? 2 : 0;
      if (!aSide) return [];
      return [{ id: m.id, aWon: m.winner_side === aSide, score: m.score ?? null, date: when(m), where: m.tournaments?.name ?? null }];
    })
    .sort((x, y) => y.date.localeCompare(x.date));
  return {
    aWins: meetings.filter((x) => x.aWon).length,
    bWins: meetings.filter((x) => !x.aWon).length,
    meetings,
  };
}

/** Last n results for anyone in `ids`: "W"/"L", newest first. */
export function recentForm(history: HistMatch[], ids: string[], n = 5): ("W" | "L")[] {
  return history
    .filter(finished)
    .map((m) => ({ m, s: overlaps(side(m, 1), ids) ? 1 : overlaps(side(m, 2), ids) ? 2 : 0 }))
    .filter((x) => x.s)
    .sort((x, y) => when(y.m).localeCompare(when(x.m)))
    .slice(0, n)
    .map((x) => (x.m.winner_side === x.s ? "W" : "L"));
}
