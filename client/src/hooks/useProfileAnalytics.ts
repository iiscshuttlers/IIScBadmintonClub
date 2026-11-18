import { useMemo, useState, useEffect } from "react";
import type { PlayerRow } from "@/types";

export function useProfileAnalytics(
  id: string | undefined,
  _player: PlayerRow | null,
  liveMatches: any[],
  _eloLogs: any[],
  ownPlayerProfile: PlayerRow | null | undefined
) {
  const [h2hRecord, setH2hRecord] = useState<{ wins: number; losses: number } | null>(null);

  useEffect(() => {
    if (
      !ownPlayerProfile ||
      !id ||
      ownPlayerProfile.id === id ||
      liveMatches.length === 0
    )
      return;
    const h2h = liveMatches.filter(
      (m) =>
        m.status === "confirmed" &&
        ((m.player1_id === ownPlayerProfile.id && m.player2_id === id) ||
          (m.player1_id === id && m.player2_id === ownPlayerProfile.id)),
    );
    if (h2h.length === 0) return;
    const wins = h2h.filter((m) => m.winner_id === ownPlayerProfile.id).length;
    const losses = h2h.filter((m) => m.winner_id === id).length;
    setH2hRecord({ wins, losses });
  }, [liveMatches, ownPlayerProfile, id]);

  const recentOpponents = useMemo(() => {
    if (!id || liveMatches.length === 0) return [];
    const confirmed = liveMatches
      .filter((m) => m.status === "confirmed")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const opponents: any[] = [];
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
    let bestOpp: any = null;
    for (const m of confirmed) {
      if (m.winner_id === id) {
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
    h2hRecord,
    recentOpponents,
    bestOpponent,
  };
}
