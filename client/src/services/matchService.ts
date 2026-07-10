import { supabase } from '@/lib/supabase';
import { MATCH_SELECT_WITH_PLAYERS } from '@/types';
import type { MatchWithPlayers } from '@/types';

export async function fetchPlayerMatches(playerId: string, limit = 50): Promise<MatchWithPlayers[]> {
  const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},team1_partner_id.eq.${playerId},team2_partner_id.eq.${playerId}`;
  const { data: friendlyData, error: friendlyError } = await supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .in("status", ["confirmed", "pending"])
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (friendlyError) throw friendlyError;

  const tFilter = `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`;
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";
  const { data: tournamentData, error: tourneyError } = await supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .in("status", ["completed"])
    .neq("tournaments.status", "deleted")
    .or(tFilter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tourneyError) throw tourneyError;

  const mappedTourney = (tournamentData ?? [])
    .filter((m: any) => {
      const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye") && !m.team1_label.toLowerCase().startsWith("winner"));
      const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye") && !m.team2_label.toLowerCase().startsWith("winner"));
      return hasTeam1 && hasTeam2;
    })
    .map((m: any) => ({
    ...m,
    is_friendly: false,
    team1_partner_id: m.player3_id,
    team2_partner_id: m.player4_id,
  }));

  const allMatches = [...(friendlyData ?? []), ...mappedTourney].sort((a: any, b: any) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return allMatches.slice(0, limit) as unknown as MatchWithPlayers[];
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
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";
  const { data: tournamentData, error: tourneyError } = await supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .eq("status", "completed")
    .neq("tournaments.status", "deleted")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tourneyError) throw tourneyError;

  const mappedTourney = (tournamentData ?? [])
    .filter((m: any) => {
      const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye") && !m.team1_label.toLowerCase().startsWith("winner"));
      const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye") && !m.team2_label.toLowerCase().startsWith("winner"));
      return hasTeam1 && hasTeam2;
    })
    .map((m: any) => ({
      ...m,
      is_friendly: false,
      team1_partner_id: m.player3_id,
      team2_partner_id: m.player4_id,
    }));

  return mappedTourney as unknown as MatchWithPlayers[];
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

  static async upsertLiveMatch(matchId: string, matchState: BwfMatchState) {
    const { error } = await supabase.rpc("upsert_live_match_by_id", {
      p_match_id: matchId,
      match_state: matchState as unknown as Record<string, unknown>,
    });
    if (error) throw error;
  }

  static async removeLiveMatch(matchId: string) {
    const { error } = await supabase.rpc("remove_live_match_by_id", { p_match_id: matchId });
    if (error) throw error;
  }
}
