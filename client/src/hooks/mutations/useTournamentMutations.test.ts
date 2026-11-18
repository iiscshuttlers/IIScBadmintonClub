import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useCreateTournament,
  useUpdateTournament,
  useArchiveTournament,
  useAdvanceTournamentWinner,
  useApproveTournamentRegistration,
  useBulkUpsertParticipants,
} from '@/hooks/mutations/useTournamentMutations';
import * as service from '@/services/tournamentService';
import { toast } from 'sonner';

vi.mock('@/services/tournamentService');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

describe('useTournamentMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCreateTournament', () => {
    it('invalidates [tournaments] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.createTournament).mockResolvedValue({ id: 't1', name: 'IISc Open' } as any);

      const { result } = renderHook(() => useCreateTournament(), { wrapper });
      result.current.mutate({ name: 'IISc Open', format: 'singles' } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournaments'] });
      expect(toast.success).toHaveBeenCalledWith('Tournament created');
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.createTournament).mockRejectedValue(new Error('Creation failed'));

      const { result } = renderHook(() => useCreateTournament(), { wrapper });
      result.current.mutate({ name: 'IISc Open', format: 'singles' } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Creation failed');
    });
  });

  describe('useUpdateTournament', () => {
    it('invalidates [tournaments] and [tournament, id] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.updateTournament).mockResolvedValue();

      const { result } = renderHook(() => useUpdateTournament(), { wrapper });
      result.current.mutate({ id: 't1', patch: { name: 'Updated Open' } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournaments'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1'] });
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.updateTournament).mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useUpdateTournament(), { wrapper });
      result.current.mutate({ id: 't1', patch: { name: 'Updated Open' } });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });

  describe('useArchiveTournament', () => {
    it('invalidates [tournaments] and [tournament, id] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.archiveTournament).mockResolvedValue();

      const { result } = renderHook(() => useArchiveTournament(), { wrapper });
      result.current.mutate('t1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournaments'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1'] });
      expect(toast.success).toHaveBeenCalledWith('Tournament archived');
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.archiveTournament).mockRejectedValue(new Error('Archive failed'));

      const { result } = renderHook(() => useArchiveTournament(), { wrapper });
      result.current.mutate('t1');

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Archive failed');
    });
  });

  describe('useAdvanceTournamentWinner', () => {
    it('invalidates [tournament, tournamentId, "matches"] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.advanceTournamentWinner).mockResolvedValue();

      const { result } = renderHook(() => useAdvanceTournamentWinner(), { wrapper });
      result.current.mutate({ tournamentId: 't1', matchId: 'm1', winnerId: 'p1' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1', 'matches'] });
      expect(toast.success).toHaveBeenCalledWith('Winner advanced');
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.advanceTournamentWinner).mockRejectedValue(new Error('Advance failed'));

      const { result } = renderHook(() => useAdvanceTournamentWinner(), { wrapper });
      result.current.mutate({ tournamentId: 't1', matchId: 'm1', winnerId: 'p1' });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Advance failed');
    });
  });

  describe('useApproveTournamentRegistration', () => {
    it('invalidates [tournament, tournamentId, "registrations"] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.approveTournamentRegistration).mockResolvedValue();

      const { result } = renderHook(() => useApproveTournamentRegistration(), { wrapper });
      result.current.mutate({ tournamentId: 't1', id: 'reg1', reviewerId: 'admin1' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1', 'registrations'] });
      expect(toast.success).toHaveBeenCalledWith('Registration approved');
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.approveTournamentRegistration).mockRejectedValue(new Error('Approve failed'));

      const { result } = renderHook(() => useApproveTournamentRegistration(), { wrapper });
      result.current.mutate({ tournamentId: 't1', id: 'reg1' });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Approve failed');
    });
  });

  describe('useBulkUpsertParticipants', () => {
    it('invalidates [tournament, tournamentId, "participants"] on success', async () => {
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      vi.mocked(service.bulkUpsertParticipants).mockResolvedValue();

      const { result } = renderHook(() => useBulkUpsertParticipants(), { wrapper });
      result.current.mutate({ tournamentId: 't1', rows: [{ tournament_id: 't1', player_id: 'p1', category: 'Open' } as any] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tournament', 't1', 'participants'] });
      expect(toast.success).toHaveBeenCalledWith('Participants updated');
    });

    it('calls toast.error on failure', async () => {
      const { wrapper } = createWrapper();
      vi.mocked(service.bulkUpsertParticipants).mockRejectedValue(new Error('Upsert failed'));

      const { result } = renderHook(() => useBulkUpsertParticipants(), { wrapper });
      result.current.mutate({ tournamentId: 't1', rows: [] });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalledWith('Upsert failed');
    });
  });
});
