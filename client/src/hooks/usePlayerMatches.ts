import { useState, useEffect, useCallback } from 'react';
import { fetchPlayerMatches } from '@/services/matchService';
import type { MatchWithPlayers } from '@/types';

export function usePlayerMatches(playerId: string | undefined) {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!playerId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const allMatches = await fetchPlayerMatches(playerId, 200);
      setMatches(allMatches);
    } catch (err) {
      setError(err as Error);
      console.error('usePlayerMatches error:', err);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { matches, loading, error, refetch };
}
