import { playerWon } from "@/lib/matchResult";
import { useMemo } from "react";
import type { PlayerRow } from "@/types";

/** An embedded player on a profile match (only these fields are read). */
type AnalyticsOpponent = { id: string; full_name?: string; elo_rating?: number | null };

/** The match fields used for head-to-head and opponent stats. */
type AnalyticsMatch = {
  status: string;
  player1_id: string | null;
  player2_id: string | null;
  team1_partner_id?: string | null;
  winner_id: string | null;
  created_at: string;
  player1?: AnalyticsOpponent | null;
  player2?: AnalyticsOpponent | null;
  partner1?: AnalyticsOpponent | null;
  partner2?: AnalyticsOpponent | null;
};

export function useProfileAnalytics(
  id: string | undefined,
  _player: PlayerRow | null,
  liveMatches: AnalyticsMatch[],
  _eloLogs: unknown[],
  _ownPlayerProfile: PlayerRow | null | undefined
) {
  // Head-to-head lives in lib/comparison (compareSides), not here.
  const recentOpponents = useMemo(() => {
    if (!id || liveMatches.length === 0) return [];
    const confirmed = liveMatches
      .filter((m) => m.status === "confirmed")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const opponents: AnalyticsOpponent[] = [];
    for (const m of confirmed) {
      const isP1 = m.player1_id === id || m.team1_partner_id === id;
      const opps = isP1 ? [m.player2, m.partner2] : [m.player1, m.partner1];
      for (const op of opps) {
        if (op && !seen.has(op.id)) {
          seen.add(op.id);
          opponents.push(op);
          if (opponents.length >= 5) return opponents;
        }
      }
    }
    return opponents;
  }, [liveMatches, id]);

  const bestOpponent = useMemo(() => {
    if (!id || liveMatches.length === 0) return null;
    const confirmed = liveMatches.filter((m) => m.status === "confirmed");
    let highestElo = -1;
    let bestOpp: AnalyticsOpponent | null = null;
    for (const m of confirmed) {
      if (playerWon(m, id) === true) {
        const isP1 = m.player1_id === id || m.team1_partner_id === id;
        const opps = isP1 ? [m.player2, m.partner2] : [m.player1, m.partner1];
        for (const op of opps) {
          if (op && op.elo_rating > highestElo) {
            highestElo = op.elo_rating;
            bestOpp = op;
          }
        }
      }
    }
    return bestOpp;
  }, [liveMatches, id]);

  return {
    recentOpponents,
    bestOpponent,
  };
}
