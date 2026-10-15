/**
 * Back-to-back warning for the Order of Play: flags matches that start too
 * soon after another match involving the same player.
 */

export interface ScheduledMatch {
  id: string;
  scheduled_at: string | null;
  status: string;
  player1_id?: string | null;
  player2_id?: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  match_code?: string | null;
}

export interface RestConflict {
  /** The later of the two matches. */
  matchId: string;
  previousMatchId: string;
  previousCode: string;
  playerId: string;
  /** Minutes between the two start times. */
  gapMins: number;
}

/** Start-to-start gap below which a player has no real rest (one ~30 min match + 15 min). */
export const DEFAULT_MIN_GAP_MINS = 45;

const ids = (m: ScheduledMatch) =>
  [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter((x): x is string => !!x && x !== "assigned");

export function findRestConflicts(matches: ScheduledMatch[], minGapMins = DEFAULT_MIN_GAP_MINS): Map<string, RestConflict[]> {
  const byPlayer = new Map<string, ScheduledMatch[]>();
  for (const m of matches) {
    if (!m.scheduled_at || m.status === "completed" || m.status === "walkover") continue;
    for (const p of ids(m)) byPlayer.set(p, [...(byPlayer.get(p) ?? []), m]);
  }
  const out = new Map<string, RestConflict[]>();
  for (const [playerId, list] of byPlayer) {
    const sorted = [...list].sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const gapMins = (Date.parse(cur.scheduled_at!) - Date.parse(prev.scheduled_at!)) / 60_000;
      if (gapMins >= minGapMins) continue;
      const c: RestConflict = {
        matchId: cur.id,
        previousMatchId: prev.id,
        previousCode: prev.match_code || "another match",
        playerId,
        gapMins: Math.round(gapMins),
      };
      out.set(cur.id, [...(out.get(cur.id) ?? []), c]);
    }
  }
  return out;
}

/** Best-effort player name for a warning: the side label containing that player. */
export function playerSideLabel(m: ScheduledMatch, playerId: string): string {
  if (m.player1_id === playerId || m.player3_id === playerId) return m.team1_label || "A player";
  if (m.player2_id === playerId || m.player4_id === playerId) return m.team2_label || "A player";
  return "A player";
}
