/**
 * Bracket predictions ("pick'em"). A prediction maps match_code → the picked
 * winner's lead player id. Later-round candidates come from the bracket slot
 * if already filled, otherwise from the user's pick in the feeder match
 * (advances_to_match / advances_to_position). Scoring: a correct pick in the
 * draw's first real round = 1 point, doubling each round.
 */

export interface PMatch {
  id: string;
  match_code: string;
  round: number;
  round_name: string | null;
  match_number: number | null;
  status: string;
  winner_side: number | null;
  advances_to_match: string | null;
  advances_to_position: number | null;
  player1_id: string | null;
  player2_id: string | null;
  team1_label: string | null;
  team2_label: string | null;
}

export type Picks = Record<string, string>;
export interface Candidate {
  id: string;
  label: string;
}

export const isByeLabel = (l: string | null) => !!l && /\bbye\b/i.test(l);
const isBye = (m: PMatch) => isByeLabel(m.team1_label) || isByeLabel(m.team2_label);
const NOT_STARTED = new Set(["scheduled", "pending"]);

/** Category locks once any real (non-bye) match has started or finished. */
export function isLocked(matches: PMatch[]): boolean {
  return matches.some((m) => !isBye(m) && !NOT_STARTED.has(m.status));
}

export function rounds(matches: PMatch[]): PMatch[][] {
  const by = new Map<number, PMatch[]>();
  for (const m of matches) by.set(m.round, [...(by.get(m.round) ?? []), m]);
  return Array.from(by.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ms]) => ms.sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0)));
}

/** Rounds worth predicting: skip a first round made only of byes. Excludes 3rd-place playoffs. */
export function predictableRounds(matches: PMatch[]): PMatch[][] {
  const main = matches.filter((m) => !/3rd|third/i.test(m.round_name ?? ""));
  return rounds(main).filter((r) => r.some((m) => !isBye(m)));
}

function feedersOf(matches: PMatch[]) {
  const f = new Map<string, { 1?: PMatch; 2?: PMatch }>();
  for (const m of matches) {
    if (!m.advances_to_match) continue;
    const slot = (m.advances_to_position === 2 ? 2 : 1) as 1 | 2;
    const cur = f.get(m.advances_to_match) ?? {};
    // If positions are missing, fill whichever slot is free.
    if (cur[slot]) cur[slot === 1 ? 2 : 1] = m;
    else cur[slot] = m;
    f.set(m.advances_to_match, cur);
  }
  return f;
}

/** The two candidates for a match, given current picks. */
export function candidates(matches: PMatch[], m: PMatch, picks: Picks): [Candidate | null, Candidate | null] {
  const feeders = feedersOf(matches).get(m.match_code) ?? {};
  const label = labelMap(matches);
  const slot = (s: 1 | 2): Candidate | null => {
    const id = s === 1 ? m.player1_id : m.player2_id;
    const lab = s === 1 ? m.team1_label : m.team2_label;
    if (id && !isByeLabel(lab)) return { id, label: lab || label.get(id) || "?" };
    const f = feeders[s];
    if (!f) return null;
    // A bye feeder sends its real player through automatically.
    if (isBye(f)) {
      const real = isByeLabel(f.team1_label) ? f.player2_id : f.player1_id;
      return real ? { id: real, label: label.get(real) || "?" } : null;
    }
    const picked = picks[f.match_code];
    return picked ? { id: picked, label: label.get(picked) || "?" } : null;
  };
  return [slot(1), slot(2)];
}

export function labelMap(matches: PMatch[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of matches) {
    if (m.player1_id && m.team1_label && !isByeLabel(m.team1_label)) map.set(m.player1_id, m.team1_label);
    if (m.player2_id && m.team2_label && !isByeLabel(m.team2_label)) map.set(m.player2_id, m.team2_label);
  }
  return map;
}

/** Set a pick and drop any later pick that is no longer reachable. */
export function setPick(matches: PMatch[], picks: Picks, code: string, winnerId: string): Picks {
  const next: Picks = { ...picks, [code]: winnerId };
  const ordered = rounds(matches).flat();
  for (const m of ordered) {
    const p = next[m.match_code];
    if (!p) continue;
    const [a, b] = candidates(matches, m, next);
    if (a?.id !== p && b?.id !== p) delete next[m.match_code];
  }
  return next;
}

export function score(matches: PMatch[], picks: Picks): { points: number; correct: number; decided: number } {
  const rs = predictableRounds(matches);
  let points = 0;
  let correct = 0;
  let decided = 0;
  rs.forEach((r, i) => {
    for (const m of r) {
      if (isBye(m) || !m.winner_side || !picks[m.match_code]) continue;
      decided++;
      const winner = m.winner_side === 1 ? m.player1_id : m.player2_id;
      if (winner && picks[m.match_code] === winner) {
        correct++;
        points += 2 ** i;
      }
    }
  });
  return { points, correct, decided };
}

/** Max possible points for a full bracket (for "x / max" display). */
export function maxPoints(matches: PMatch[]): number {
  return predictableRounds(matches).reduce((s, r, i) => s + r.filter((m) => !isBye(m)).length * 2 ** i, 0);
}
