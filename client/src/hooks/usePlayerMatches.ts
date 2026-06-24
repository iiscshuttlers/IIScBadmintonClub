import { useState, useEffect, useCallback } from 'react';
import { fetchPlayerMatches, fetchPendingMatchesForPlayer } from '@/services/matchService';
import type { MatchWithPlayers } from '@/types';

export function usePlayerMatches(playerId: string | undefined) {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [pendingMatches, setPendingMatches] = useState<MatchWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!playerId) {
      setMatches([]);
      setPendingMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allMatches, pending] = await Promise.all([
        fetchPlayerMatches(playerId, 100),
        fetchPendingMatchesForPlayer(playerId)
      ]);
      setMatches(allMatches);
      setPendingMatches(pending);
    } catch (err: any) {
      setError(err);
      console.error('usePlayerMatches error:', err);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { matches, pendingMatches, loading, error, refetch };
}
