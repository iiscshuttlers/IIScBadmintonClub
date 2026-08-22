// Court occupancy — the single source of truth for where players stand.
//
// A doubles pair's positions are described by one number per team: which player
// (0 or 1) currently stands in that team's RIGHT service court. That is a
// property of the pair alone — it survives a change of ends, and it changes
// only when the pair itself swaps courts (i.e. when they win a rally on their
// own serve, BWF 9.1.6/9.2).
//
// Everything else — who serves, who receives, and where each name is drawn on
// the court diagram — is derived from it.

/** Which service court a player occupies, given their team's right-court holder. */
export function isInRightCourt(pIdx: 0 | 1, rightCourt: 0 | 1): boolean {
  return pIdx === rightCourt;
}

/**
 * Whether a player is drawn in the TOP half of the court diagram.
 *
 * The diagram is viewed from above with the net running vertically, so the two
 * sides are mirror images: the left-hand team's right service court is the
 * BOTTOM row, the right-hand team's right service court is the TOP row.
 */
export function isPlayerAtTop(pIdx: 0 | 1, rightCourt: 0 | 1, teamOnLeft: boolean): boolean {
  const inRight = isInRightCourt(pIdx, rightCourt);
  return teamOnLeft ? !inRight : inRight;
}

/**
 * Reconstruct a team's right-court holder from serve/receive state.
 *
 * Used to seed matches saved before the court-position fields existed. At an
 * even serving score the server stands in their right court, and the receiver
 * stands in theirs (the diagonal maps right court to right court across the
 * net); at an odd score both are in their left courts.
 */
export function seedRightCourt(playerIdx: 0 | 1, serverScoreIsEven: boolean): 0 | 1 {
  return (serverScoreIsEven ? playerIdx : 1 - playerIdx) as 0 | 1;
}

/** Seed both teams' right-court holders from a legacy serve/receive snapshot. */
export function seedRightCourts(state: {
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  receiverPlayerIndex: 0 | 1;
  serverScore: number;
  t1RightCourt?: 0 | 1;
  t2RightCourt?: 0 | 1;
}): { t1Right: 0 | 1; t2Right: 0 | 1 } {
  const isEven = state.serverScore % 2 === 0;
  const serving = seedRightCourt(state.serverPlayerIndex, isEven);
  const receiving = seedRightCourt(state.receiverPlayerIndex, isEven);
  return {
    t1Right: state.t1RightCourt ?? (state.serverTeam === 1 ? serving : receiving),
    t2Right: state.t2RightCourt ?? (state.serverTeam === 2 ? serving : receiving),
  };
}
