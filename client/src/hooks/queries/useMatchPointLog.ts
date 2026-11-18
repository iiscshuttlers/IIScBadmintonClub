import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Stored point log for a tournament match (plan item 6). The key starts with
 * "tournament_matches" so it refreshes with every live score update through
 * RealtimeProvider. Returns null when no log exists (older matches).
 */
export interface StoredPointLog {
  points: unknown;
  pointCount: number;
  final: boolean;
  supersededByCorrection: boolean;
  updatedAt: string;
}

export function useMatchPointLog(tournamentId: string, matchId: string, enabled = true) {
  return useQuery<StoredPointLog | null>({
    queryKey: ["tournament_matches", tournamentId, "point-log", matchId],
    enabled: enabled && !!matchId,
    staleTime: 10_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_match_point_logs")
        .select("points, point_count, final, superseded_by_correction, updated_at")
        .eq("match_id", matchId)
        .maybeSingle();
      // Table missing (migration not applied yet) or no row: no Points tab.
      if (error || !data) return null;
      const d = data as { points: unknown; point_count: number; final: boolean; superseded_by_correction: boolean; updated_at: string };
      return {
        points: d.points,
        pointCount: d.point_count,
        final: d.final,
        supersededByCorrection: d.superseded_by_correction,
        updatedAt: d.updated_at,
      };
    },
  });
}
