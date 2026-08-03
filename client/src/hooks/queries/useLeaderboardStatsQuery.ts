import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface LeaderboardStats {
  upsets: any[];
  activeStreaks: any[];
  allStreaks: Record<string, number>;
  lastEloChange: Record<string, number>;
  eloHistory: Record<string, number[]>;
  tournamentRecords?: Record<string, string>;
}

export function useLeaderboardStatsQuery(categoryFilter: string, eloMode: "club" | "tournament", enabled: boolean = true) {
  return useQuery<LeaderboardStats>({
    queryKey: ["leaderboard-stats", categoryFilter, eloMode],
    queryFn: async () => {
      if (eloMode === "tournament") {
        let query = supabase
          .from("tournament_matches")
          .select("*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url), partner1:players!player3_id(id, full_name, avatar_url), partner2:players!player4_id(id, full_name, avatar_url)")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (categoryFilter !== "ALL") {
          query = query.eq("category", categoryFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data) return { upsets: [], activeStreaks: [], allStreaks: {}, lastEloChange: {}, eloHistory: {}, tournamentRecords: {} };

        const playerStreaks: Record<string, { id: string, name: string, avatar: string, streak: number, isAlive: boolean }> = {};
        const recordsMap: Record<string, { w: number; l: number }> = {};

        for (const match of data) {
           const isP1Winner = match.winner_side === 1;

           const updatePlayer = (pId: string, pName: string, pAvatar: string, won: boolean) => {
             if (!pId) return;
             if (!playerStreaks[pId]) {
               playerStreaks[pId] = { id: pId, name: pName, avatar: pAvatar, streak: 0, isAlive: true };
             }
             if (playerStreaks[pId].isAlive) {
               if (won) playerStreaks[pId].streak += 1;
               else playerStreaks[pId].isAlive = false;
             }
             if (!recordsMap[pId]) recordsMap[pId] = { w: 0, l: 0 };
             if (won) recordsMap[pId].w++;
             else recordsMap[pId].l++;
           };

           if (match.player1) updatePlayer(match.player1.id, match.player1.full_name, match.player1.avatar_url, isP1Winner);
           if (match.player2) updatePlayer(match.player2.id, match.player2.full_name, match.player2.avatar_url, !isP1Winner);
           if (match.partner1) updatePlayer(match.partner1.id, match.partner1.full_name, match.partner1.avatar_url, isP1Winner);
           if (match.partner2) updatePlayer(match.partner2.id, match.partner2.full_name, match.partner2.avatar_url, !isP1Winner);
        }

        const topStreaks = Object.values(playerStreaks)
          .filter(p => p.streak > 1)
          .sort((a, b) => b.streak - a.streak)
          .slice(0, 5);
        
        const allStrks: Record<string, number> = {};
        Object.values(playerStreaks).forEach(p => { allStrks[p.id] = p.streak; });

        const formattedRecords: Record<string, string> = {};
        for (const pId in recordsMap) {
           formattedRecords[pId] = `${recordsMap[pId].w}W - ${recordsMap[pId].l}L`;
        }

        return {
          upsets: [],
          activeStreaks: topStreaks,
          allStreaks: allStrks,
          lastEloChange: {},
          eloHistory: {},
          tournamentRecords: formattedRecords
        };
      }

      let query = supabase
        .from("matches")
        .select("*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url), partner1:players!team1_partner_id(id, full_name, avatar_url), partner2:players!team2_partner_id(id, full_name, avatar_url)")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(200);

      if (categoryFilter !== "ALL") {
        const dbCategory =
          categoryFilter === "MS" || categoryFilter === "WS" ? "Singles" :
          categoryFilter === "MD" || categoryFilter === "WD" || categoryFilter === "XD" ? "Doubles" :
          categoryFilter;
        query = query.eq("category", dbCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return { upsets: [], activeStreaks: [], allStreaks: {}, lastEloChange: {}, eloHistory: {} };

      // Process Upsets
      const significantUpsets = data
        .filter(m => m.elo_change_p1 !== undefined && m.elo_change_p2 !== undefined)
        .map(m => {
          const isP1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
          const upsetScoreRaw = isP1Winner ? (m.elo_change_p1 || 0) : (m.elo_change_p2 || 0);
          const upsetScore = categoryFilter === "ALL" ? Math.floor(upsetScoreRaw / 3) : upsetScoreRaw;
          return { ...m, upsetScore };
        })
        .filter(m => m.upsetScore > (categoryFilter === "ALL" ? 6 : 20))
        .sort((a, b) => b.upsetScore - a.upsetScore)
        .slice(0, 3);

      // Process Elo History
      const lastChange: Record<string, number> = {};
      const history: Record<string, number[]> = {};
      for (const match of data) {
        const players4 = [
          { id: match.player1_id, change: match.elo_change_p1 },
          { id: match.player2_id, change: match.elo_change_p2 },
          { id: match.team1_partner_id, change: match.elo_change_p3 },
          { id: match.team2_partner_id, change: match.elo_change_p4 },
        ];
        for (const p of players4) {
          if (p.id && p.change != null) {
            const displayChange = categoryFilter === "ALL" ? Math.floor(p.change / 3) : p.change;
            if (!history[p.id]) history[p.id] = [];
            if (history[p.id].length < 5) history[p.id].push(displayChange);
            if (!(p.id in lastChange)) lastChange[p.id] = displayChange;
          }
        }
      }

      // Process Streaks
      const playerStreaks: Record<string, { id: string, name: string, avatar: string, streak: number, isAlive: boolean }> = {};
      for (const match of data) {
        const isP1Winner = match.winner_id === match.player1_id || match.winner_id === match.team1_partner_id;
        const updatePlayer = (pId: string, pName: string, pAvatar: string, won: boolean) => {
          if (!pId) return;
          if (!playerStreaks[pId]) {
            playerStreaks[pId] = { id: pId, name: pName, avatar: pAvatar, streak: 0, isAlive: true };
          }
          if (playerStreaks[pId].isAlive) {
            if (won) playerStreaks[pId].streak += 1;
            else playerStreaks[pId].isAlive = false;
          }
        };
        if (match.player1) updatePlayer(match.player1.id, match.player1.full_name, match.player1.avatar_url, isP1Winner);
        if (match.player2) updatePlayer(match.player2.id, match.player2.full_name, match.player2.avatar_url, !isP1Winner);
        if (match.partner1) updatePlayer(match.partner1.id, match.partner1.full_name, match.partner1.avatar_url, isP1Winner);
        if (match.partner2) updatePlayer(match.partner2.id, match.partner2.full_name, match.partner2.avatar_url, !isP1Winner);
      }

      const topStreaks = Object.values(playerStreaks)
        .filter(p => p.streak > 1)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5);
      
      const allStrks: Record<string, number> = {};
      Object.values(playerStreaks).forEach(p => { allStrks[p.id] = p.streak; });

      return {
        upsets: significantUpsets,
        activeStreaks: topStreaks,
        allStreaks: allStrks,
        lastEloChange: lastChange,
        eloHistory: history
      };
    },
    enabled: enabled,
    refetchInterval: (query) => (query.state.error ? false : 60_000),
  });
}
