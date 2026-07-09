import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchFeedMatches, fetchPlayerMatches } from "@/services/matchService";
import { supabase } from "@/lib/supabase";

export function useFeedMatches(limit = 100) {
  return useQuery({
    queryKey: ["matches", "feed", limit],
    queryFn: () => fetchFeedMatches(limit),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function usePlayerMatches(playerId: string, limit = 50) {
  return useQuery({
    queryKey: ["matches", "player", playerId, limit],
    queryFn: () => fetchPlayerMatches(playerId, limit),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useLiveSiteData(key: string, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ["site_data", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_data").select("value").eq("key", key).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.value as any;
    },
    staleTime: 1000 * 60 * 60, // 1 hour (revalidated by real-time)
    refetchInterval,
  });
}
