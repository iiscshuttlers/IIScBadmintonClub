import { useQuery } from '@tanstack/react-query';
import { fetchPlayerMatches } from '@/services/matchService';
import type { MatchWithPlayers } from '@/types';

const EMPTY: MatchWithPlayers[] = [];

/**
 * A player's tournament matches (up to 200). Cached per player, so the
 * profile's Overview, Stats and Matches tabs share one fetch.
 */
export function usePlayerMatches(playerId: string | undefined) {
  const query = useQuery({
    queryKey: ['player-matches', playerId],
    queryFn: () => fetchPlayerMatches(playerId!, 200),
    enabled: !!playerId,
    staleTime: 30_000,
  });

  return {
    matches: query.data ?? EMPTY,
    loading: !!playerId && query.isPending,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}
