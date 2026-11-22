/**
 * Pairs the rounds of one format with the rounds of another, so a whole
 * format's scoring rules can be copied across (Scoring Rules panel).
 *
 * Rounds pair by name first ("Final" ↔ "Final", "Round of 32" ↔ "Round of 32").
 * A round with no namesake pairs by distance from the last round, so a
 * 6-round draw copied from a 7-round one still lines its final up with the
 * final. Both lists must be sorted by round number, ascending.
 */

export interface RoundRef {
  round: number;
  round_name: string | null;
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** target round → source round. Empty when the source has no rounds. */
export function pairRounds(target: RoundRef[], source: RoundRef[]): Map<number, number> {
  const out = new Map<number, number>();
  if (source.length === 0) return out;
  const byName = new Map<string, number>();
  for (const r of source) if (r.round_name && !byName.has(norm(r.round_name))) byName.set(norm(r.round_name), r.round);
  target.forEach((t, i) => {
    const named = t.round_name ? byName.get(norm(t.round_name)) : undefined;
    if (named != null) {
      out.set(t.round, named);
      return;
    }
    const fromEnd = target.length - 1 - i;
    out.set(t.round, source[Math.max(0, source.length - 1 - fromEnd)].round);
  });
  return out;
}
