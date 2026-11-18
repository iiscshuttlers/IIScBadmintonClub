import { useQuery } from "@tanstack/react-query";
import { fetchRecentForm, type FormByPlayer } from "@/services/formService";

/**
 * Last-n tournament form for every player on a screen, in one request.
 * The key starts with "tournament_matches" so corrected results refresh
 * through RealtimeProvider's invalidation.
 */
export function useRecentForm(playerIds: Array<string | null | undefined>, n = 5) {
  const ids = Array.from(new Set(playerIds.filter((x): x is string => !!x))).sort();
  return useQuery<FormByPlayer>({
    queryKey: ["tournament_matches", "form", ids, n],
    queryFn: () => fetchRecentForm(ids, n),
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}
