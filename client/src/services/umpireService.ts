import { supabase } from '@/lib/supabase';
import type { BwfMatchState } from '@/types/umpire';
import { PLAYER_PUBLIC_COLUMNS } from "@/lib/playerColumns";

export interface MatchAlertParams {
  tournamentId?: string;
  court: string;
  message: string;
}

export interface EmergencyLineupParams {
  tieId: string;
  rubbers: any;
  reason: string;
}

export interface AddDeciderParams {
  tieId: string;
  pointsToWin?: number;
  bestOfSets?: number;
  label?: string;
  category?: string;
}

export const umpireService = {
  // Live matches registry in site_data
  async fetchLiveMatchesRegistry(): Promise<Record<string, any>> {
    const { data } = await supabase
      .from('site_data')
      .select('value')
      .eq('key', 'live_matches')
      .maybeSingle();
    return (data?.value as Record<string, any>) || {};
  },

  async saveLiveMatchesRegistry(registry: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('site_data')
      .upsert({ key: 'live_matches', value: registry });
    if (error) throw error;
  },

  async upsertLiveMatch(matchId: string, matchState: BwfMatchState): Promise<void> {
    const { error } = await supabase.rpc('upsert_live_match_by_id', {
      p_match_id: matchId,
      match_state: matchState as any,
    });
    if (error) throw error;
  },

  subscribeToLiveMatchesRegistry(callback: (value: any) => void): () => void {
    const sub = supabase
      .channel("live_matches_registry_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => {
          if ((payload.new as any)?.value) callback((payload.new as any).value);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  },

  async resetMatchToScheduled(tournamentMatchId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('admin_update_tournament_match' as any, {
      p_match_id: tournamentMatchId,
      p_patch: { status: 'scheduled' },
      p_reason: reason,
      p_operation_id: crypto.randomUUID(),
    });
    if (error) throw error;
  },

  async pushMatchAlert(params: MatchAlertParams): Promise<void> {
    await supabase.from('site_data').upsert({
      key: 'match_alert',
      value: { message: params.message, time: Date.now() },
    });

    const { error } = await supabase.rpc('push_match_alert', {
      p_tournament_id: params.tournamentId || '',
      p_court: params.court,
      p_message: params.message,
    });
    if (error) console.error('push_match_alert error:', error);
  },

  async invokePushLiveScore(payload: any): Promise<any> {
    const { data, error } = await supabase.functions.invoke('push-live-score', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  // Tie format RPCs & queries
  async fetchTieById(tieId: string): Promise<any> {
    const { data, error } = await supabase
      .from('tournament_ties')
      .select('*')
      .eq('id', tieId)
      .single();
    if (error) throw error;
    return data;
  },

  async fetchTieRubbers(tieId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
        player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
        player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
        player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url)
      `)
      .eq('tie_id', tieId)
      .order('rubber_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async fetchTieTeams(teamIds: string[]): Promise<any[]> {
    if (!teamIds.length) return [];
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('*')
      .in('id', teamIds);
    if (error) throw error;
    return data || [];
  },

  async fetchTieTeamRosters(teamIds: string[]): Promise<any[]> {
    if (!teamIds.length) return [];
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select(`*, players(${PLAYER_PUBLIC_COLUMNS})`)
      .in('team_id', teamIds)
      .eq('status', 'ACTIVE');
    if (error) throw error;
    return data || [];
  },

  // Tie format queries
  async fetchTieLineupsBoth(tieId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tie_lineups')
      .select(`
        *,
        player1:players!tie_lineups_player1_id_fkey(id, full_name),
        player2:players!tie_lineups_player2_id_fkey(id, full_name),
        revealer:players!tie_lineups_revealed_by_fkey(id, full_name)
      `)
      .eq('tie_id', tieId);
    if (error) throw error;
    return data || [];
  },

  async fetchTieMatches(tieId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select(`
        *,
        player1:players!tournament_matches_player1_id_fkey(id, full_name),
        player2:players!tournament_matches_player2_id_fkey(id, full_name),
        revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
      `)
      .eq('tie_id', tieId);
    if (error) throw error;
    return data || [];
  },

  async fetchTeamMembers(teamId: string): Promise<any[]> {
    if (!teamId) return [];
    const { data, error } = await supabase
      .from('tournament_team_members')
      .select(`*, players(${PLAYER_PUBLIC_COLUMNS})`)
      .eq('team_id', teamId)
      .eq('status', 'ACTIVE');
    if (error) throw error;
    return data || [];
  },

  async fetchTieLineupAudits(tieId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tie_lineup_audits')
      .select(`
        *,
        referee:players!tie_lineup_audits_referee_id_fkey(full_name),
        orig_player:players!tie_lineup_audits_original_player_id_fkey(full_name),
        repl_player:players!tie_lineup_audits_replacement_player_id_fkey(full_name)
      `)
      .eq('tie_id', tieId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async revealTieLineup(params: { tieId: string; rubberOrder?: number | null }): Promise<void> {
    const { error } = await supabase.rpc('reveal_tie_lineup', {
      p_tie_id: params.tieId,
      p_rubber_order: params.rubberOrder ?? undefined,
    });
    if (error) throw error;
  },

  async setTiePlayingOrder(params: { tieId: string; playingOrders: { rubber_order: number; playing_order: number }[]; reason?: string }): Promise<void> {
    const { error } = await supabase.rpc('set_tie_playing_order', {
      p_tie_id: params.tieId,
      p_playing_orders: params.playingOrders,
      p_reason: params.reason || 'Playing order arbitrated and confirmed by match official',
    });
    if (error) throw error;
  },

  async emergencyModifyLineup(params: {
    tieId: string;
    side: string;
    rubberOrder: number;
    pos: number;
    newPlayerId: string;
    reason: string;
    bothCaptainsAgreed?: boolean;
  }): Promise<void> {
    const { error } = await (supabase.rpc as any)('emergency_modify_lineup', {
      p_tie_id: params.tieId,
      p_side: params.side,
      p_rubber_order: params.rubberOrder,
      p_pos: params.pos,
      p_new_player_id: params.newPlayerId,
      p_reason: params.reason,
      p_both_captains_agreed: params.bothCaptainsAgreed ?? true,
    });
    if (error) throw error;
  },

  async addDeciderRubber(params: {
    tieId: string;
    category: string;
    label: string;
    bestOfSets: number;
    pointsToWin: number;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('add_decider_rubber_to_tie', {
      p_tie_id: params.tieId,
      p_category: params.category,
      p_label: params.label,
      p_best_of_sets: params.bestOfSets,
      p_points_to_win: params.pointsToWin,
    });
    if (error) throw error;
    return data;
  },

  async revealDeciderRubber(tieId: string): Promise<any> {
    const { data, error } = await supabase.rpc('reveal_decider_rubber', {
      p_tie_id: tieId,
    });
    if (error) throw error;
    return data;
  },

  // Rally & Sensor analytics
  async recordMotionStats(stats: Record<string, any>): Promise<void> {
    const { error } = await supabase.from('match_motion_stats' as any).upsert(stats);
    if (error) throw error;
  },

  async recordSensorAnalytics(analytics: Record<string, any>): Promise<void> {
    const { error } = await supabase.from('match_sensor_analytics' as any).upsert(analytics);
    if (error) throw error;
  },

  async reconcileRallyMatchId(oldMatchId: string, newMatchId: string): Promise<void> {
    const { error } = await supabase
      .from('match_rally_stats' as any)
      .update({ match_id: newMatchId })
      .eq('match_id', oldMatchId)
      .eq('match_source', 'friendly');
    if (error) console.error('Failed to reconcile rally match id', error);
  },

  async reconcileRallyStats(matchId: string, rallyIndex: number, stats: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('match_rally_stats' as any)
      .update(stats)
      .eq('match_id', matchId)
      .eq('rally_index', rallyIndex);
    if (error) throw error;
  },

  async insertRallyStats(stats: Record<string, any>): Promise<void> {
    const { error } = await supabase.from('match_rally_stats' as any).insert(stats);
    if (error) throw error;
  },
};
