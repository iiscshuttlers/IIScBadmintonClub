import { useState, useEffect, useCallback } from 'react';
import { fetchPlayer } from '@/services/playerService';
import type { PlayerRow } from '@/types';

export function usePlayer(id: string | undefined) {
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setPlayer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlayer(id);
      setPlayer(data);
    } catch (err: any) {
      setError(err);
      console.error('usePlayer error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { player, loading, error, refetch };
}
