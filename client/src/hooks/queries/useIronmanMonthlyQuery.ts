import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useIronmanMonthlyQuery(enabled: boolean = true) {
  return useQuery<Record<string, number>>({
    queryKey: ["ironman-monthly-counts"],
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from("matches")
        .select("player1_id, player2_id, team1_partner_id, team2_partner_id")
        .eq("status", "confirmed")
        .gte("created_at", startOfMonth);

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      if (data) {
        for (const match of data) {
          [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id].forEach(id => {
            if (id) counts[id] = (counts[id] || 0) + 1;
          });
        }
      }
      return counts;
    },
    enabled: enabled,
    refetchInterval: 60_000,
  });
}
