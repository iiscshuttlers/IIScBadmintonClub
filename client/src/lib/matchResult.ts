/**
 * Who won a match — one rule for every surface.
 *
 * `winner_side` decides (1 = player1 + player3 / team1 partner, 2 = player2 +
 * player4 / team2 partner), the same rule as the stored W/L records.
 * `winner_id` is only a fallback for rows without `winner_side`: it names a
 * single slot (so a partner's win looks like a loss) and is NULL when a guest
 * wins.
 */

export type ResultRow = {
  winner_side?: number | null;
  winner_id?: string | null;
  /** Legacy friendly column. */
  match_winner_id?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
  /** Profile/feed rows map player3/player4 onto these. */
  team1_partner_id?: string | null;
  team2_partner_id?: string | null;
  /** Embedded player rows; only their `id` is read, when present. */
  player1?: unknown;
  player2?: unknown;
  partner1?: unknown;
  partner2?: unknown;
};

const idOf = (p: unknown): string | null =>
  p && typeof p === "object" && "id" in p && typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : null;

/** Player IDs on one side of a match (any of the column shapes in use). */
export function sideIds(m: ResultRow, side: 1 | 2): string[] {
  const ids =
    side === 1
      ? [m.player1_id, m.player3_id, m.team1_partner_id, idOf(m.player1), idOf(m.partner1)]
      : [m.player2_id, m.player4_id, m.team2_partner_id, idOf(m.player2), idOf(m.partner2)];
  return [...new Set(ids.filter((x): x is string => !!x))];
}

/** Which side a player was on, or null if they weren't in the match. */
export function sideOf(m: ResultRow, playerId: string | null | undefined): 1 | 2 | null {
  if (!playerId) return null;
  if (sideIds(m, 1).includes(playerId)) return 1;
  if (sideIds(m, 2).includes(playerId)) return 2;
  return null;
}

/** The winning side, or null when no result is recorded. */
export function winningSide(m: ResultRow): 1 | 2 | null {
  if (m.winner_side === 1 || m.winner_side === 2) return m.winner_side;
  const w = m.winner_id ?? m.match_winner_id;
  if (!w) return null;
  if (sideIds(m, 1).includes(w)) return 1;
  if (sideIds(m, 2).includes(w)) return 2;
  return null;
}

/** true / false when the player was in a decided match; null otherwise. */
export function playerWon(m: ResultRow, playerId: string | null | undefined): boolean | null {
  const side = sideOf(m, playerId);
  const winner = winningSide(m);
  if (side == null || winner == null) return null;
  return side === winner;
}
