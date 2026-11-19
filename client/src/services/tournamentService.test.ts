import { vi, expect, it, describe, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  fetchTournaments,
  fetchTournamentById,
  fetchTournamentMatches,
  startTournamentMatchChecked,
  submitTournamentMatch,
  fetchTournamentMatchConflictContext,
  applyTournamentMatchCorrection,
  overrideTournamentSchedule,
  verifyTournamentReadiness,
  transitionTournamentLifecycle,
  setTournamentRoundRule,
} from '@/services/tournamentService';

const mockT = { id: '1', name: 'Test Tournament', status: 'upcoming' };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('tournamentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTournaments', () => {
    it('returns tournament array on success', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [mockT], error: null }),
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await fetchTournaments();
      expect(result).toEqual([mockT]);
    });

    it('throws on Supabase error', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      await expect(fetchTournaments()).rejects.toThrow('DB error');
    });
  });

  describe('fetchTournamentById', () => {
    it('returns single tournament', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: mockT, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await fetchTournamentById('1');
      expect(result).toEqual(mockT);
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });
  });

  describe('fetchTournamentMatches', () => {
    it('fetches matches sorted by round and match_number', async () => {
      const mockMatch = { id: 'm1', tournament_id: '1', round: 1, match_number: 1 };
      const mockOrder2 = vi.fn().mockResolvedValue({ data: [mockMatch], error: null });
      const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await fetchTournamentMatches('1');
      expect(result).toEqual([mockMatch]);
      expect(mockEq).toHaveBeenCalledWith('tournament_id', '1');
    });
  });

  describe('submitTournamentMatch', () => {
    it('uses the revisioned idempotent RPC and returns its receipt', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { applied: true, revision: 1, operation_id: 'op-1', reason: 'applied' },
        error: null,
      } as any);

      const result = await submitTournamentMatch({
        p_match_id: 'match-1',
        p_winner_side: 2,
        p_score: '21-18, 21-19',
        p_sets: ['21-18', '21-19'],
        p_umpire_id: 'umpire-1',
        p_expected_revision: 0,
        p_operation_id: 'op-1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('submit_tournament_match_v2', {
        p_match_id: 'match-1',
        p_winner_side: 2,
        p_score: '21-18, 21-19',
        p_sets: ['21-18', '21-19'],
        p_umpire_id: 'umpire-1',
        p_expected_revision: 0,
        p_operation_id: 'op-1',
      });
      expect(result).toMatchObject({ applied: true, revision: 1 });
    });

    it('surfaces a revision conflict', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('result_revision_conflict: expected 0, current 1'),
      } as any);

      await expect(submitTournamentMatch({
        p_match_id: 'match-1',
        p_winner_side: 1,
        p_score: '21-10',
        p_operation_id: 'op-2',
      })).rejects.toThrow('result_revision_conflict');
    });
  });

  describe('startTournamentMatchChecked', () => {
    it('revalidates the expected court and schedule through the checked-start RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { applied: true, reason: 'started', started_at: '2026-11-13T03:30:00Z' },
        error: null,
      } as any);

      const result = await startTournamentMatchChecked({
        p_match_id: 'match-1',
        p_expected_court: 'C2',
        p_expected_scheduled_at: '2026-11-13T03:00:00Z',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('start_tournament_match_checked', {
        p_match_id: 'match-1',
        p_expected_court: 'C2',
        p_expected_scheduled_at: '2026-11-13T03:00:00Z',
      });
      expect(result).toMatchObject({ applied: true, reason: 'started' });
    });
  });

  describe('fetchTournamentMatchConflictContext', () => {
    it('fetches server match, actor and downstream match status', async () => {
      const mockMatch = {
        id: 'm-1',
        tournament_id: 't-1',
        category: 'XD',
        round: 1,
        match_code: 'R1-1',
        match_number: 101,
        status: 'completed',
        winner_side: 1,
        score: '21-19, 21-17',
        sets_history: ['21-19', '21-17'],
        team1_label: 'Alice / Bob',
        team2_label: 'Charlie / Dana',
        scored_by: 'umpire-uid',
        scored_at: '2026-11-13T10:00:00Z',
        advances_to_match: 'QF-1',
        advances_to_match_loser: null,
        result_revision: 1,
        result_operation_id: 'op-1',
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'tournament_matches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === 'id') {
                  return { single: vi.fn().mockResolvedValue({ data: mockMatch, error: null }) };
                }
                if (col === 'tournament_id') {
                  return {
                    in: vi.fn().mockResolvedValue({
                      data: [{ id: 'm-2', match_code: 'QF-1', status: 'pending', score: null, started_at: null }],
                      error: null,
                    }),
                  };
                }
                return {};
              }),
            }),
          };
        }
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { full_name: 'Official Dave' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const conflict = await fetchTournamentMatchConflictContext({
        matchId: 'm-1',
        localRevision: 0,
        localWinnerSide: 2,
        localScore: '19-21, 17-21',
        localSets: ['19-21', '17-21'],
        team1Label: 'Alice / Bob',
        team2Label: 'Charlie / Dana',
      });

      expect(conflict.matchId).toBe('m-1');
      expect(conflict.category).toBe('XD');
      expect(conflict.serverRevision).toBe(1);
      expect(conflict.localRevision).toBe(0);
      expect(conflict.serverScore).toBe('21-19, 21-17');
      expect(conflict.lastActorName).toBe('Official Dave');
      expect(conflict.downstreamStarted).toBe(false);
    });

    it('detects when a downstream match has already started', async () => {
      const mockMatch = {
        id: 'm-1',
        tournament_id: 't-1',
        category: 'MD',
        status: 'completed',
        winner_side: 1,
        score: '21-15',
        sets_history: ['21-15'],
        advances_to_match: 'SF-1',
        result_revision: 1,
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'tournament_matches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string) => {
                if (col === 'id') {
                  return { single: vi.fn().mockResolvedValue({ data: mockMatch, error: null }) };
                }
                return {
                  in: vi.fn().mockResolvedValue({
                    data: [{ id: 'm-3', match_code: 'SF-1', status: 'live', score: '5-2', started_at: '2026-11-13T10:15:00Z' }],
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const conflict = await fetchTournamentMatchConflictContext({
        matchId: 'm-1',
        localRevision: 0,
        localWinnerSide: 1,
        localScore: '21-10',
        localSets: ['21-10'],
      });

      expect(conflict.downstreamStarted).toBe(true);
      expect(conflict.downstreamMatchCode).toBe('SF-1');
    });
  });

  describe('applyTournamentMatchCorrection', () => {
    it('calls apply_tournament_match_correction RPC with expected parameters', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { applied: true, revision: 2, operation_id: 'op-corr-1' },
        error: null,
      } as any);

      const result = await applyTournamentMatchCorrection({
        matchId: 'm-1',
        winnerSide: 2,
        score: '19-21, 17-21',
        sets: ['19-21', '17-21'],
        expectedRevision: 1,
        reason: 'Corrected score entry error verified with players',
        operationId: 'op-corr-1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('apply_tournament_match_correction', {
        p_match_id: 'm-1',
        p_winner_side: 2,
        p_score: '19-21, 17-21',
        p_sets: ['19-21', '17-21'],
        p_expected_revision: 1,
        p_reason: 'Corrected score entry error verified with players',
        p_operation_id: 'op-corr-1',
      });
      expect(result).toMatchObject({ applied: true, revision: 2 });
    });
  });

  describe('overrideTournamentSchedule', () => {
    it('calls override_tournament_schedule RPC with attribution parameters', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { applied: true, match_id: 'm-1', court_number: '2', scheduled_at: '2026-11-15T10:00:00Z' },
        error: null,
      } as any);

      const result = await overrideTournamentSchedule({
        tournamentId: 'tour-1',
        matchId: 'm-1',
        court: '2',
        scheduledAt: '2026-11-15T10:00:00Z',
        reason: 'Authorized schedule override by tournament director',
        conflictType: 'court_warning',
        conflictingId: 'm-2',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('override_tournament_schedule', {
        p_tournament_id: 'tour-1',
        p_match_id: 'm-1',
        p_court: '2',
        p_scheduled_at: '2026-11-15T10:00:00Z',
        p_reason: 'Authorized schedule override by tournament director',
        p_conflict_type: 'court_warning',
        p_conflicting_id: 'm-2',
      });
      expect(result).toMatchObject({ applied: true, match_id: 'm-1' });
    });

    it('throws if override RPC returns an error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('court_unavailable: court 2 is in blackout period'),
      } as any);

      await expect(
        overrideTournamentSchedule({
          tournamentId: 'tour-1',
          matchId: 'm-1',
          court: '2',
          scheduledAt: '2026-11-15T10:00:00Z',
          reason: 'Attempt override into blackout',
        })
      ).rejects.toThrow('court_unavailable');
    });
  });

  describe('verifyTournamentReadiness', () => {
    it('calls verify_tournament_readiness RPC and returns structured report', async () => {
      const mockReport = {
        action: 'start_play',
        allowed: false,
        blockers: [
          { code: 'UNSCHEDULED_PLAYABLE_MATCHES', message: 'Assign court and time', fix_tab: 'schedule', severity: 'blocker' },
        ],
        warnings: [],
      };
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockReport,
        error: null,
      } as any);

      const result = await verifyTournamentReadiness('tour-1', 'start_play');
      expect(supabase.rpc).toHaveBeenCalledWith('verify_tournament_readiness', {
        p_tournament_id: 'tour-1',
        p_action: 'start_play',
      });
      expect(result).toEqual(mockReport);
    });

    it('throws error when verify RPC fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('Tournament not found'),
      } as any);

      await expect(verifyTournamentReadiness('tour-missing', 'announce')).rejects.toThrow('Tournament not found');
    });
  });

  describe('transitionTournamentLifecycle', () => {
    it('calls transition_tournament_lifecycle RPC and returns receipt with applied status', async () => {
      const mockReceipt = {
        applied: true,
        action: 'publish_draw',
        tournament_id: 'tour-1',
        report: { allowed: true, blockers: [], warnings: [] },
      };
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockReceipt,
        error: null,
      } as any);

      const result = await transitionTournamentLifecycle('tour-1', 'publish_draw');
      expect(supabase.rpc).toHaveBeenCalledWith('transition_tournament_lifecycle', {
        p_tournament_id: 'tour-1',
        p_action: 'publish_draw',
      });
      expect(result).toEqual(mockReceipt);
    });

    it('throws error when transition is blocked by readiness gates', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('Cannot start_play tournament: tournament_not_ready: Assign court and time'),
      } as any);

      await expect(transitionTournamentLifecycle('tour-1', 'start_play')).rejects.toThrow('Cannot start_play tournament');
    });
  });

  describe('setTournamentRoundRule', () => {
    const rule = {
      tournament_id: 'tour-1', category: 'MS', round: 2, round_name: 'Final',
      points_to_win: 15, best_of_sets: 3, golden_point: 21,
    };

    it('saves through set_tournament_round_rule', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      await setTournamentRoundRule(rule);

      expect(supabase.rpc).toHaveBeenCalledWith('set_tournament_round_rule', {
        p_tournament_id: 'tour-1', p_category: 'MS', p_round: 2, p_round_name: 'Final',
        p_points_to_win: 15, p_best_of_sets: 3, p_golden_point: 21,
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('throws the RPC error (e.g. a host refused)', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: { code: '42501', message: 'Only the tournament\'s host or an admin can change its scoring rules' } });

      await expect(setTournamentRoundRule(rule)).rejects.toMatchObject({ code: '42501' });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('falls back to the direct writes when the function is missing', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
      const upsert = vi.fn().mockResolvedValue({ error: null });
      const eq3 = vi.fn().mockResolvedValue({ error: null });
      const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const update = vi.fn().mockReturnValue({ eq: eq1 });
      (supabase.from as any).mockImplementation((table: string) =>
        table === 'tournament_round_rules' ? { upsert } : { update });

      await setTournamentRoundRule(rule);

      expect(upsert).toHaveBeenCalledWith(rule, { onConflict: 'tournament_id,category,round' });
      expect(update).toHaveBeenCalledWith({ points_to_win: 15, best_of_sets: 3, golden_point: 21 });
      expect(eq1).toHaveBeenCalledWith('tournament_id', 'tour-1');
      expect(eq2).toHaveBeenCalledWith('category', 'MS');
      expect(eq3).toHaveBeenCalledWith('round', 2);
    });
  });
});
