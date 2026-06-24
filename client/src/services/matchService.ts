import { supabase } from '@/lib/supabase';
import { MATCH_SELECT_WITH_PLAYERS } from '@/types';
import type { MatchWithPlayers } from '@/types';

export async function fetchPlayerMatches(playerId: string, limit = 50): Promise<MatchWithPlayers[]> {
  const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},team1_partner_id.eq.${playerId},team2_partner_id.eq.${playerId}`;
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .in("status", ["confirmed", "pending"])
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as MatchWithPlayers[];
}

export async function fetchPendingMatchesForPlayer(playerId: string): Promise<MatchWithPlayers[]> {
  const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},team1_partner_id.eq.${playerId},team2_partner_id.eq.${playerId}`;
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("status", "pending")
    .neq("submitted_by", playerId)
    .or(filter);
  if (error) throw error;
  return (data ?? []) as unknown as MatchWithPlayers[];
}

export async function fetchFeedMatches(limit = 100): Promise<MatchWithPlayers[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as MatchWithPlayers[];
}

export async function confirmMatch(matchId: string, confirmerId: string) {
  const { data, error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchId, confirmer_id: confirmerId });
  if (error) throw error;
  return data;
}

import type { BwfMatchState } from "@/types/umpire";

export class MatchService {
  static async updateMatch(
    matchUuid: string,
    winnerId: string | undefined,
    matchScore: string,
    matchCategory: string,
    setsHistory: string[]
  ) {
    const { error } = await supabase.rpc("umpire_update_match", {
      match_uuid: matchUuid,
      winner_id: winnerId,
      match_score: matchScore,
      match_category: matchCategory,
      sets_history: setsHistory
    });
    if (error) throw error;
  }

  static async submitMatch(payload: any) {
    const { data: submitId, error: submitError } = await supabase.rpc("umpire_submit_match", payload);
    if (submitError) throw submitError;
    return submitId;
  }

  static async confirmFriendlyMatch(matchUuid: string) {
    const { error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchUuid });
    if (error) throw error;
  }

  static async upsertLiveMatch(umpireUserId: string, matchState: BwfMatchState) {
    const { error } = await supabase.rpc("upsert_live_match", {
      umpire_user_id: umpireUserId,
      match_state: matchState as unknown as Record<string, unknown>,
    });
    if (error) throw error;
  }

  static async removeLiveMatch(umpireUserId: string) {
    const { error } = await supabase.rpc("remove_live_match", { umpire_user_id: umpireUserId });
    if (error) throw error;
  }
}
