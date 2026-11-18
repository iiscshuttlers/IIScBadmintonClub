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
  category?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface RestConflict {
  /** The later of the two matches. */
  matchId: string;
  previousMatchId: string;
  previousCode: string;
  playerId: string;
  /** Minutes of rest after the previous match's actual or estimated end. */
  gapMins: number;
  timingBasis: "actual" | "estimated";
  conflictType: "hard" | "warning";
  minRestMinutes?: number;
  description?: string;
}

export const DEFAULT_MIN_REST_MINS = 15;
export const DEFAULT_ESTIMATED_MATCH_MINS = 30;

const ids = (m: ScheduledMatch) =>
  [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter((x): x is string => !!x && x !== "assigned");

const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : Number.NaN;

export function findRestConflicts(
  matches: ScheduledMatch[],
  optionsOrMinRest?: { minRestMinutes?: number; estimatedMinutes?: number } | number,
  estimatedMatchMinsParam?: number,
): Map<string, RestConflict[]> {
  const minRestMins = typeof optionsOrMinRest === "number"
    ? optionsOrMinRest
    : (optionsOrMinRest?.minRestMinutes ?? DEFAULT_MIN_REST_MINS);
  const estimatedMatchMins = typeof optionsOrMinRest === "number"
    ? (estimatedMatchMinsParam ?? DEFAULT_ESTIMATED_MATCH_MINS)
    : (optionsOrMinRest?.estimatedMinutes ?? DEFAULT_ESTIMATED_MATCH_MINS);

  const byPlayer = new Map<string, ScheduledMatch[]>();
  for (const m of matches) {
    if ((!m.scheduled_at && !m.started_at) || m.status === "walkover") continue;
    for (const p of ids(m)) byPlayer.set(p, [...(byPlayer.get(p) ?? []), m]);
  }
  const out = new Map<string, RestConflict[]>();
  for (const [playerId, list] of byPlayer) {
    const sorted = [...list].sort((a, b) =>
      timestamp(a.started_at ?? a.scheduled_at) - timestamp(b.started_at ?? b.scheduled_at),
    );
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur.status === "completed" || cur.status === "walkover" || !cur.scheduled_at) continue;

      const currentStart = timestamp(cur.scheduled_at);
      const candidates = sorted.slice(0, i)
        .map((previous) => {
          const actualEnd = timestamp(previous.ended_at);
          const previousStart = timestamp(previous.started_at ?? previous.scheduled_at);
          return {
            previous,
            timingBasis: Number.isFinite(actualEnd) ? "actual" as const : "estimated" as const,
            end: Number.isFinite(actualEnd) ? actualEnd : previousStart + estimatedMatchMins * 60_000,
          };
        })
        .filter((candidate) => Number.isFinite(candidate.end))
        .sort((a, b) => b.end - a.end);

      const nearest = candidates[0];
      if (!nearest) continue;
      const gapMins = (currentStart - nearest.end) / 60_000;
      if (gapMins >= minRestMins) continue;
      const isHard = nearest.timingBasis === "actual" && gapMins < minRestMins;
      const c: RestConflict = {
        matchId: cur.id,
        previousMatchId: nearest.previous.id,
        previousCode: nearest.previous.match_code || "another match",
        playerId,
        gapMins: Math.round(gapMins),
        timingBasis: nearest.timingBasis,
        conflictType: isHard ? "hard" : "warning",
        minRestMinutes: minRestMins,
        description: isHard
          ? `Actual rest of ${Math.round(gapMins)}m is below required ${minRestMins}m minimum`
          : `Estimated rest of ${Math.round(gapMins)}m is below ${minRestMins}m minimum`,
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
