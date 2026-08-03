import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useIronmanMonthlyQuery(eloMode: "club" | "tournament", enabled: boolean = true) {
  return useQuery<Record<string, number>>({
    queryKey: ["ironman-monthly-counts", eloMode],
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const tableName = eloMode === "tournament" ? "tournament_matches" : "matches";
      const { data, error } = eloMode === "tournament"
        ? await supabase
            .from("tournament_matches")
            .select("player1_id, player2_id, player3_id, player4_id")
            .eq("status", "completed")
            .gte("created_at", startOfMonth)
        : await supabase
            .from("matches")
            .select("player1_id, player2_id, team1_partner_id, team2_partner_id")
            .eq("status", "confirmed")
            .gte("created_at", startOfMonth);

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      if (data) {
        for (const match of (data as any[])) {
          const ids = eloMode === "tournament" 
            ? [match.player1_id, match.player2_id, match.player3_id, match.player4_id]
            : [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id];
          ids.forEach(id => {
            if (id) counts[id] = (counts[id] || 0) + 1;
          });
        }
      }
      return counts;
    },
    enabled: enabled,
    refetchInterval: (query) => (query.state.error ? false : 60_000),
  });
}
