import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayerProfileQuery } from '@/hooks/queries/usePlayerProfileQuery';
import * as service from '@/services/playerService';
import * as matchService from '@/services/matchService';

vi.mock('@/services/playerService');
vi.mock('@/services/matchService', () => ({
  fetchPlayerMatches: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'p1', full_name: 'Raja', avatar_url: '', elo_rating: 1200 },
        error: null,
      }),
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('usePlayerProfileQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns player on success', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePlayerProfileQuery('p1', 'p1'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.player?.full_name).toBe('Raja');
    expect(result.current.player).not.toHaveProperty('fullName');
  });

  it('verifies query cache key matches playerProfile', async () => {
    const { queryClient, wrapper } = createWrapper();
    renderHook(() => usePlayerProfileQuery('p1', 'p1'), { wrapper });

    await waitFor(() => {
      const state = queryClient.getQueryState(['playerProfile', 'p1']);
      expect(state).toBeDefined();
    });
  });

  it('handles null id gracefully by not enabling query', () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => usePlayerProfileQuery(undefined, undefined), { wrapper });

    expect(result.current.player).toBeUndefined();
    const state = queryClient.getQueryState(['playerProfile', undefined]);
    expect(state?.fetchStatus).toBe('idle');
  });
});
