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
