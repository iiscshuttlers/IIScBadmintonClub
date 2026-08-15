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

export async function fetchFeedMatches(
  limit = 100,
  categoryFilter = "all",
  timeFilter = "all",
  tournamentFilter = "all"
): Promise<MatchWithPlayers[]> {
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";

  let friendlyQuery = supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .in("status", ["confirmed"]);

  let tourneyQuery = supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .eq("status", "completed")
    .neq("tournaments.status", "deleted");

  if (tournamentFilter !== "all") {
    friendlyQuery = friendlyQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // Don't fetch friendly matches for a specific tournament
    tourneyQuery = tourneyQuery.eq("tournament_id", tournamentFilter);
  }

  if (categoryFilter !== "all") {
    if (categoryFilter === "singles") {
      // Singles matches typically don't have doubles in category, or are explicitly MS/WS
      friendlyQuery = friendlyQuery.not("category", "ilike", "%Doubles%");
      tourneyQuery = tourneyQuery.not("category", "ilike", "%Doubles%");
    } else if (categoryFilter === "doubles") {
      friendlyQuery = friendlyQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
      tourneyQuery = tourneyQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
    } else if (categoryFilter === "mixed") {
      friendlyQuery = friendlyQuery.ilike("category", "%Mixed%");
      tourneyQuery = tourneyQuery.ilike("category", "%Mixed%");
    }
  }

  if (timeFilter !== "all") {
    const now = new Date();
    if (timeFilter === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      friendlyQuery = friendlyQuery.gte("created_at", today);
      tourneyQuery = tourneyQuery.gte("created_at", today);
    } else if (timeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      friendlyQuery = friendlyQuery.gte("created_at", weekAgo.toISOString());
      tourneyQuery = tourneyQuery.gte("created_at", weekAgo.toISOString());
    } else if (timeFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      friendlyQuery = friendlyQuery.gte("created_at", monthStart);
      tourneyQuery = tourneyQuery.gte("created_at", monthStart);
    }
  }

  const [{ data: friendlyData, error: friendlyError }, { data: tournamentData, error: tourneyError }] = await Promise.all([
    friendlyQuery.order("created_at", { ascending: false }).limit(limit),
    tourneyQuery.order("created_at", { ascending: false }).limit(limit)
  ]);

  if (friendlyError) throw friendlyError;
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
    const { error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchUuid, confirmer_id: "umpire_bypass" });
    if (error) throw error;
  }

  private static liveMatchDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  static async upsertLiveMatch(matchId: string, matchState: BwfMatchState) {
    // 1. Instant sub-50ms WebSocket broadcast directly to camera & TV screens
    try {
      supabase.channel("court_live_scores").send({
        type: "broadcast",
        event: "score_update",
        payload: matchState,
      });
    } catch (e) {
      console.warn("Realtime broadcast send warning", e);
    }

    // 2. Persist to site_data in Supabase DB (Debounced by 500ms)
    if (MatchService.liveMatchDebounceTimers[matchId]) {
      clearTimeout(MatchService.liveMatchDebounceTimers[matchId]);
    }

    return new Promise<void>((resolve, reject) => {
      MatchService.liveMatchDebounceTimers[matchId] = setTimeout(async () => {
        try {
          const { error } = await supabase.rpc("upsert_live_match_by_id", {
            p_match_id: matchId,
            match_state: matchState as any,
          });
          if (error) reject(error);
          else resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);
    });
  }

  static async removeLiveMatch(matchId: string) {
    const { error } = await supabase.rpc("remove_live_match_by_id", { p_match_id: matchId });
    if (error) throw error;
  }
}
