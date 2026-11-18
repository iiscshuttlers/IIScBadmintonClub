import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toMovementMap, type RankList, type RankMovement } from "@/lib/rankMovement";

/** playerId → movement for one ranking list. Empty until snapshots exist. */
export function useRankingMovement(list: RankList, enabled = true) {
  return useQuery<Record<string, RankMovement>>({
    queryKey: ["ranking-movement", list],
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking_movement", { p_list: list });
      // Migration not applied yet → no arrows rather than an error.
      if (error) return {};
      return toMovementMap((data ?? []) as Parameters<typeof toMovementMap>[0]);
    },
  });
}
