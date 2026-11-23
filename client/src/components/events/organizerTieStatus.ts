/**
 * Tie facts the organiser dashboard needs but tournament_ties doesn't store:
 * courts and reveal state live on the tie's rubbers (tournament_matches rows
 * with tie_id). Revealing lineups fills each rubber's player ids
 * (reveal_lineups), so a tie is revealed once every regular rubber has both
 * sides' players.
 */

export interface RubberRow {
  tie_id: string | null;
  court_number: string | null;
  status: string | null;
  player1_id: string | null;
  player2_id: string | null;
  is_decider_tiebreaker?: boolean | null;
}

/** A tie's regular rubbers (the golden decider is added later and revealed on its own). */
function regularRubbers<T extends RubberRow>(tieId: string, matches: readonly T[]): T[] {
  return matches.filter((m) => m.tie_id === tieId && !m.is_decider_tiebreaker);
}

/** Every regular rubber has both sides' players, so the lineups are out. */
export function isTieRevealed(tieId: string, matches: readonly RubberRow[]): boolean {
  const rubbers = regularRubbers(tieId, matches);
  return rubbers.length > 0 && rubbers.every((m) => !!m.player1_id && !!m.player2_id);
}

/** Distinct courts of the tie's rubbers that still have to be played, in natural order. */
export function tieCourts(tieId: string, matches: readonly RubberRow[]): string[] {
  const courts = new Set<string>();
  for (const m of matches) {
    if (m.tie_id !== tieId || m.status === "completed") continue;
    const court = (m.court_number ?? "").trim();
    if (court) courts.add(court);
  }
  return [...courts].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
