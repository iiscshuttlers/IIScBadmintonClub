import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TournamentMatchStat {
  id: string;
  tournament_id: string;
  category: string;
  winner_side: 1 | 2;
  player1_id: string;
  player2_id: string;
  player3_id: string | null;
  player4_id: string | null;
  status: string;
}

export function useAllTournamentMatches() {
  return useQuery<TournamentMatchStat[]>({
    queryKey: ["allTournamentMatches"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, tournament_id, category, winner_side, player1_id, player2_id, player3_id, player4_id, status")
        .eq("status", "completed");

      if (error) {
        console.error("Failed to fetch all tournament matches:", error);
        return [];
      }
      return data as TournamentMatchStat[];
    },
  });
}
