import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TournamentRun {
  tournament_id: string;
  tournament_name: string;
  category: string;
  wins: number;
  losses: number;
  deepest_round_name: string;
  eliminated: boolean; // true = lost a match; false = still in or won it all
}

export function useTournamentMatchHistory(playerId: string | undefined) {
  return useQuery<TournamentRun[]>({
    queryKey: ["tournamentMatchHistory", playerId],
    enabled: !!playerId,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!playerId) return [];

      const { data, error } = await supabase
        .from("tournament_matches")
        .select("tournament_id, category, round, round_name, winner_side, player1_id, player2_id, player3_id, player4_id, status, tournaments(name)")
        .eq("status", "completed")
        .or(
          `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`
        )
        .order("round", { ascending: true });

      if (error) throw error;
      if (!data) return [];

      // Group by tournament + category
      const map = new Map<string, TournamentRun>();

      for (const m of data as any[]) {
        const key = `${m.tournament_id}__${m.category}`;
        const isTeam1 =
          m.player1_id === playerId || m.player3_id === playerId;
        const playerWon =
          (isTeam1 && m.winner_side === 1) ||
          (!isTeam1 && m.winner_side === 2);

        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            tournament_id: m.tournament_id,
            tournament_name: m.tournaments?.name ?? "Tournament",
            category: m.category,
            wins: playerWon ? 1 : 0,
            losses: playerWon ? 0 : 1,
            deepest_round_name: m.round_name ?? `Round ${m.round}`,
            eliminated: !playerWon,
          });
        } else {
          if (playerWon) existing.wins++;
          else { existing.losses++; existing.eliminated = true; }
          // Keep the highest round as "deepest"
          if (m.round > (existing as any)._round) {
            existing.deepest_round_name = m.round_name ?? `Round ${m.round}`;
          }
          (existing as any)._round = Math.max((existing as any)._round ?? 0, m.round);
        }
      }

      return Array.from(map.values());
    },
  });
}
