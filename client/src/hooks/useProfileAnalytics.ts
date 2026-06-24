import { useMemo, useState, useEffect } from "react";
import type { PlayerProfileType } from "@/types";

export function useProfileAnalytics(
  id: string | undefined,
  player: PlayerProfileType | null,
  liveMatches: any[],
  eloLogs: any[],
  ownPlayerProfile: PlayerProfileType | null | undefined
) {
  const [eloChartFilter, setEloChartFilter] = useState<"ALL" | "S" | "D" | "XD">("ALL");
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

  const eloHistoryData = useMemo(() => {
    if (!id || !player) return [];

    let currentElo = 1200;
    if (eloChartFilter === "ALL" && player.elo_rating) currentElo = player.elo_rating;
    if (eloChartFilter === "S" && player.singles_elo) currentElo = player.singles_elo;
    if (eloChartFilter === "D" && player.doubles_elo) currentElo = player.doubles_elo;
    if (eloChartFilter === "XD" && player.mixed_elo) currentElo = player.mixed_elo;

    const history = [];

    const filteredLogs = eloLogs.filter((log) => {
      if (eloChartFilter === "S" && log.category !== "Singles") return false;
      if ((eloChartFilter === "D" || eloChartFilter === "XD") && log.category !== "Doubles") return false;
      return true;
    });

    if (filteredLogs.length > 0) {
      history.push({
        name: "Start",
        elo: eloChartFilter === "ALL" ? 1200 : filteredLogs[0].previous_elo,
      });

      let rollingAllElo = 1200;
      filteredLogs.forEach((log) => {
        if (eloChartFilter === "ALL") {
          rollingAllElo += Math.trunc((log.elo_change || 0) / 3);
        }
        history.push({
          name: new Date(log.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          elo: eloChartFilter === "ALL" ? rollingAllElo : log.new_elo,
        });
      });

      if (history.length > 0) {
        history[history.length - 1].elo = currentElo;
      }
    } else {
      history.push({ name: "Current", elo: currentElo });
    }

    return history;
  }, [eloLogs, id, player, eloChartFilter]);

  return {
    h2hRecord,
    recentOpponents,
    bestOpponent,
    eloHistoryData,
    eloChartFilter,
    setEloChartFilter,
  };
}
