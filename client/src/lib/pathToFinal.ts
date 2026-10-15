/**
 * "Path to the final": from a player's current match, follow the bracket's
 * advances_to_match links to the final and predict who they'd most likely meet
 * in each round (decided winner if played, otherwise the higher-rated side,
 * recursing into undecided feeder matches).
 */

export interface PathMatch {
  id: string;
  /** advances_to_match references this code (e.g. "MS_R2_01"), not the row id. */
  match_code?: string | null;
  round: number | null;
  round_name: string | null;
  status: string;
  winner_side: number | null;
  advances_to_match: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team1_label: string | null;
  team2_label: string | null;
}

export interface SideInfo {
  label: string;
  ids: string[];
  rating: number | null;
}

export interface PathStep {
  matchId: string;
  roundName: string;
  /** Known opponent (already in the slot) or the predicted one. */
  opponent: SideInfo | null;
  predicted: boolean;
  /** Your side's win probability vs that opponent, by Elo. */
  winProb: number | null;
  played: boolean;
}

const isBye = (l: string | null) => !!l && /\bbye\b/i.test(l);

export function sideOf(m: PathMatch, side: 1 | 2, elo: (id: string) => number | undefined): SideInfo | null {
  const ids = (side === 1 ? [m.player1_id, m.player3_id] : [m.player2_id, m.player4_id]).filter((x): x is string => !!x);
  const label = side === 1 ? m.team1_label : m.team2_label;
  if (!ids.length || isBye(label)) return null;
  const rs = ids.map(elo).filter((x): x is number => x != null);
  return { label: label || "TBD", ids, rating: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null };
}

const winProb = (a: number | null, b: number | null) =>
  a == null || b == null ? null : 1 / (1 + Math.pow(10, (b - a) / 400));

export function computePath(matches: PathMatch[], playerId: string, elo: (id: string) => number | undefined): PathStep[] {
  // advances_to_match holds a match_code in practice; accept a row id too.
  const byRef = new Map<string, PathMatch>();
  for (const m of matches) {
    byRef.set(m.id, m);
    if (m.match_code) byRef.set(m.match_code, m);
  }
  const feeders = new Map<string, PathMatch[]>();
  for (const m of matches) {
    const target = m.advances_to_match ? byRef.get(m.advances_to_match) : undefined;
    if (target) feeders.set(target.id, [...(feeders.get(target.id) ?? []), m]);
  }

  const has = (m: PathMatch, side: 1 | 2) =>
    (side === 1 ? [m.player1_id, m.player3_id] : [m.player2_id, m.player4_id]).includes(playerId);

  // Predicted winner of any match (memoised; recursion into feeders for empty slots).
  const memo = new Map<string, SideInfo | null>();
  const predictWinner = (m: PathMatch): SideInfo | null => {
    if (memo.has(m.id)) return memo.get(m.id)!;
    let res: SideInfo | null;
    if (m.winner_side === 1 || m.winner_side === 2) res = sideOf(m, m.winner_side, elo);
    else {
      const fs = (feeders.get(m.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
      const s1 = sideOf(m, 1, elo) ?? (fs[0] ? predictWinner(fs[0]) : null);
      const s2 = sideOf(m, 2, elo) ?? (fs[1] ? predictWinner(fs[1]) : null);
      if (!s1 || !s2) res = s1 ?? s2;
      else res = (s1.rating ?? 0) >= (s2.rating ?? 0) ? s1 : s2;
    }
    memo.set(m.id, res);
    return res;
  };

  // Start: the player's latest not-yet-lost match (live/upcoming, or last won).
  const mine = matches
    .filter((m) => has(m, 1) || has(m, 2))
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  if (!mine.length) return [];
  const last = mine[mine.length - 1];
  const mySide: 1 | 2 = has(last, 1) ? 1 : 2;
  if (last.winner_side && last.winner_side !== mySide) return []; // knocked out
  const me = sideOf(last, mySide, elo);

  const steps: PathStep[] = [];
  let cur: PathMatch | undefined = last;
  let cameFrom: string | null = null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    let opponent: SideInfo | null;
    let predicted = false;
    if (cameFrom === null) {
      opponent = sideOf(cur, mySide === 1 ? 2 : 1, elo);
    } else {
      // The slot not fed by our path.
      const other = (feeders.get(cur.id) ?? []).find((f) => f.id !== cameFrom);
      const inSlot = [sideOf(cur, 1, elo), sideOf(cur, 2, elo)].find((s) => s && !s.ids.includes(playerId)) ?? null;
      opponent = inSlot ?? (other ? predictWinner(other) : null);
      predicted = !inSlot;
    }
    const played = !!cur.winner_side;
    steps.push({
      matchId: cur.id,
      roundName: cur.round_name || `Round ${cur.round ?? "?"}`,
      opponent,
      predicted,
      winProb: winProb(me?.rating ?? null, opponent?.rating ?? null),
      played,
    });
    cameFrom = cur.id;
    cur = cur.advances_to_match ? byRef.get(cur.advances_to_match) : undefined;
  }
  return steps;
}
