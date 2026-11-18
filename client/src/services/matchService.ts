import { supabase } from '@/lib/supabase';
import { MATCH_SELECT_WITH_PLAYERS } from '@/types';
import type { MatchWithPlayers } from '@/types';
import { deleteTournamentMatch } from './tournamentService';

export async function fetchPlayerMatches(playerId: string, limit = 200): Promise<MatchWithPlayers[]> {
  try {
    const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`;
    const { data: unifiedData, error: unifiedError } = await supabase
      .from("player_matches_unified")
      .select("*")
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!unifiedError && unifiedData) {
      const pIds = new Set<string>();
      for (const m of unifiedData as any[]) {
        if (m.player1_id) pIds.add(m.player1_id);
        if (m.player2_id) pIds.add(m.player2_id);
        if (m.player3_id) pIds.add(m.player3_id);
        if (m.player4_id) pIds.add(m.player4_id);
      }
      const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";
      const { data: playerRows } = await supabase
        .from("players")
        .select(playerSelect)
        .in("id", Array.from(pIds));

      const pMap = new Map((playerRows ?? []).map((p: any) => [p.id, p]));
      return (unifiedData as any[]).map((m: any) => ({
        ...m,
        team1_partner_id: m.player3_id,
        team2_partner_id: m.player4_id,
        player1: m.player1_id ? pMap.get(m.player1_id) ?? null : null,
        player2: m.player2_id ? pMap.get(m.player2_id) ?? null : null,
        partner1: m.player3_id ? pMap.get(m.player3_id) ?? null : null,
        partner2: m.player4_id ? pMap.get(m.player4_id) ?? null : null,
      })) as unknown as MatchWithPlayers[];
    }
  } catch {
    /* intentional — fallback to dual tables if view is unavailable on remote database */
  }

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
    .select(`*, tournaments!inner(status, counts_for_elo), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .in("status", ["completed", "scheduled", "in_progress", "walkover"])
    .neq("tournaments.status", "deleted")
    .or(tFilter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tourneyError) throw tourneyError;

  const mappedTourney = (tournamentData ?? [])
    .filter((m: any) => {
      const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye"));
      const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye"));
      return hasTeam1 && hasTeam2;
    })
    .map((m: any) => ({
      ...m,
      is_friendly: false,
      counts_for_elo: m.tournaments?.counts_for_elo,
      team1_partner_id: m.player3_id,
      team2_partner_id: m.player4_id,
    }));

  const allMatches = [...(friendlyData ?? []), ...mappedTourney].sort((a: any, b: any) => {
    const dateA = a.ended_at || a.scheduled_at || a.date || a.created_at;
    const dateB = b.ended_at || b.scheduled_at || b.date || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
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
  tournamentFilter = "all",
  opts: { includeFriendlies?: boolean } = {},
): Promise<MatchWithPlayers[]> {
  // Pulse's match list is tournament-only (owner decision 5, 14 Nov 2026);
  // other callers keep the original mixed feed.
  const includeFriendlies = opts.includeFriendlies ?? true;
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";

  let friendlyQuery = supabase
    .from("matches")
    .select(MATCH_SELECT_WITH_PLAYERS)
    .in("status", ["confirmed"]);

  let tourneyCompletedQuery = supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status, counts_for_elo), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .eq("status", "completed")
    .neq("tournaments.status", "deleted");

  let tourneyUpcomingQuery = supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status, counts_for_elo), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .in("status", ["scheduled", "in_progress"])
    .neq("tournaments.status", "deleted");

  const isTournamentSpecific = !!tournamentFilter && tournamentFilter !== "all";

  if (isTournamentSpecific) {
    friendlyQuery = friendlyQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // Don't fetch friendly matches for a specific tournament
    tourneyCompletedQuery = tourneyCompletedQuery.eq("tournament_id", tournamentFilter);
    tourneyUpcomingQuery = tourneyUpcomingQuery.eq("tournament_id", tournamentFilter);
  }

  if (/^(MS|WS|MD|WD|XD)$/.test(categoryFilter)) {
    // Exact discipline (MS vs WS), the same rule as the Match Centre.
    const disc = `category.eq.${categoryFilter},match_code.like.${categoryFilter}_%`;
    tourneyCompletedQuery = tourneyCompletedQuery.or(disc);
    tourneyUpcomingQuery = tourneyUpcomingQuery.or(disc);
    friendlyQuery = friendlyQuery.eq("category", categoryFilter);
  } else if (categoryFilter !== "all") {
    if (categoryFilter === "singles") {
      friendlyQuery = friendlyQuery.not("category", "ilike", "%Doubles%");
      tourneyCompletedQuery = tourneyCompletedQuery.not("category", "ilike", "%Doubles%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.not("category", "ilike", "%Doubles%");
    } else if (categoryFilter === "doubles") {
      friendlyQuery = friendlyQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
      tourneyCompletedQuery = tourneyCompletedQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
    } else if (categoryFilter === "mixed") {
      friendlyQuery = friendlyQuery.ilike("category", "%Mixed%");
      tourneyCompletedQuery = tourneyCompletedQuery.ilike("category", "%Mixed%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.ilike("category", "%Mixed%");
    }
  }

  if (timeFilter !== "all") {
    const now = new Date();
    if (timeFilter === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      friendlyQuery = friendlyQuery.gte("created_at", today);
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", today);
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", today);
    } else if (timeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      friendlyQuery = friendlyQuery.gte("created_at", weekAgo.toISOString());
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", weekAgo.toISOString());
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", weekAgo.toISOString());
    } else if (timeFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      friendlyQuery = friendlyQuery.gte("created_at", monthStart);
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", monthStart);
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", monthStart);
    }
  }

    const [
      { data: friendlyData, error: friendlyError },
      { data: completedData, error: completedError },
      { data: upcomingData, error: upcomingError }
    ] = await Promise.all([
      isTournamentSpecific || !includeFriendlies ? Promise.resolve({ data: [], error: null }) : friendlyQuery.order("created_at", { ascending: false }).limit(limit),
      tourneyCompletedQuery.order("created_at", { ascending: false }).limit(limit),
      tourneyUpcomingQuery.order("scheduled_at", { ascending: true }).limit(limit)
    ]);
  
    if (friendlyError) throw friendlyError;
    if (completedError) throw completedError;
    if (upcomingError) throw upcomingError;
  
    const mappedTourney = [...(completedData ?? []), ...(upcomingData ?? [])]
      .filter((m: any) => {
        if (isTournamentSpecific && m.tournament_id !== tournamentFilter) return false;
        const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye"));
        const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye"));
        return hasTeam1 && hasTeam2;
      })
      .map((m: any) => ({
        ...m,
        is_friendly: false, counts_for_elo: m.tournaments?.counts_for_elo,
        team1_partner_id: m.player3_id,
        team2_partner_id: m.player4_id,
      }));
  
    const allMatches = [...(friendlyData ?? []), ...mappedTourney].sort((a: any, b: any) => {
      const dateA = a.ended_at || a.scheduled_at || a.date || a.created_at;
      const dateB = b.ended_at || b.scheduled_at || b.date || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
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
  /** Latest state per match that has not reached the database yet. */
  private static pendingLiveMatches: Record<string, BwfMatchState> = {};
  private static flushHandlersBound = false;

  /** Callers awaiting the next successful write for a match. */
  private static liveMatchWaiters: Record<string, { resolve: () => void; reject: (e: unknown) => void }[]> = {};

  private static async writeLiveMatch(matchId: string) {
    const state = MatchService.pendingLiveMatches[matchId];
    const waiters = MatchService.liveMatchWaiters[matchId] ?? [];
    delete MatchService.liveMatchWaiters[matchId];
    if (!state) {
      waiters.forEach(w => w.resolve());
      return;
    }
    delete MatchService.pendingLiveMatches[matchId];
    if (MatchService.liveMatchDebounceTimers[matchId]) {
      clearTimeout(MatchService.liveMatchDebounceTimers[matchId]);
      delete MatchService.liveMatchDebounceTimers[matchId];
    }
    try {
      const { error } = await supabase.rpc("upsert_live_match_by_id", {
        p_match_id: matchId,
        match_state: state as any,
      });
      if (error) throw error;
      waiters.forEach(w => w.resolve());
    } catch (e) {
      waiters.forEach(w => w.reject(e));
      throw e;
    }
  }

  /**
   * Write every debounced score straight away.
   *
   * The 500ms debounce is a real data-loss window on mobile: backgrounding the
   * tab suspends timers, so a pending write could sit unsent indefinitely and
   * the match would be left with a stale (or missing) live snapshot — the state
   * an umpire later fails to resume from.
   */
  static async flushLiveMatches() {
    await Promise.all(
      Object.keys(MatchService.pendingLiveMatches).map(id =>
        MatchService.writeLiveMatch(id).catch(e => console.warn("Live match flush failed", e)),
      ),
    );
  }

  private static bindFlushHandlers() {
    if (MatchService.flushHandlersBound || typeof window === "undefined") return;
    MatchService.flushHandlersBound = true;
    const flush = () => { void MatchService.flushLiveMatches(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

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

    // 2. Persist to site_data in Supabase DB (debounced by 500ms).
    // Superseded calls used to be dropped with their promise left forever
    // pending, so the caller's `await` never returned and everything after it —
    // including the tournament_matches score sync — was silently skipped.
    // The newest state now subsumes the older one and both callers settle.
    MatchService.bindFlushHandlers();
    MatchService.pendingLiveMatches[matchId] = matchState;
    if (MatchService.liveMatchDebounceTimers[matchId]) {
      clearTimeout(MatchService.liveMatchDebounceTimers[matchId]);
    }

    return new Promise<void>((resolve, reject) => {
      (MatchService.liveMatchWaiters[matchId] ??= []).push({ resolve, reject });
      MatchService.liveMatchDebounceTimers[matchId] = setTimeout(() => {
        void MatchService.writeLiveMatch(matchId).catch(() => {});
      }, 500);
    });
  }

  static async removeLiveMatch(matchId: string) {
    const { error } = await supabase.rpc("remove_live_match_by_id", { p_match_id: matchId });
    if (error) throw error;
  }

  static async getLiveMatchesAdminList(limit = 10): Promise<any[]> {
    return getLiveMatchesAdminList(limit);
  }

  static async updateLiveMatchStatus(id: string, status: string): Promise<void> {
    return updateLiveMatchStatus(id, status);
  }

  static async deleteLiveMatch(id: string): Promise<void> {
    return deleteLiveMatch(id);
  }

  static async fetchPlayerMatches(playerId: string, limit = 50) {
    return fetchPlayerMatches(playerId, limit);
  }

  static async fetchPendingMatchesForPlayer(playerId: string) {
    return fetchPendingMatchesForPlayer(playerId);
  }

  static async fetchFeedMatches(limit = 50) {
    return fetchFeedMatches(limit);
  }

  static async countPendingMatchesForPlayer(playerId: string) {
    return countPendingMatchesForPlayer(playerId);
  }
}

export async function fetchFriendlyMatchesForAdmin(limit = 500) {
  const { data, error } = await supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(id, full_name, avatar_url, gender),
      player2:players!matches_player2_id_fkey(id, full_name, avatar_url, gender),
      partner1:players!team1_partner_id(id, full_name, avatar_url, gender),
      partner2:players!team2_partner_id(id, full_name, avatar_url, gender)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchTournamentMatchesForAdmin(tournamentId: string, category: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      tournaments(name),
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .not("winner_side", "is", null)
    .not("score", "is", null)
    .order("scored_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deleteFriendlyMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}



export async function deleteMatchRecord(id: string, isTournament: boolean): Promise<void> {
  if (isTournament) {
    return deleteTournamentMatch(id);
  }
  return deleteFriendlyMatch(id);
}

export async function rejectFriendlyMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").update({ status: "rejected" }).eq("id", id);
  if (error) throw error;
}

export async function fileMatchDispute(matchId: string, disputeReason: string, fallbackUserId: string): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: fallbackUserId,
    title: "⚠️ Match Disputed",
    message: `Match #${matchId.slice(0, 8)} disputed by a player: "${disputeReason}"`,
    type: "match_dispute",
    link: `/feed`,
  });
  const { error } = await (supabase.from("matches").update as any)({ is_disputed: true, dispute_reason: disputeReason }).eq("id", matchId);
  if (error) throw error;
}

export async function fetchTodayTournamentMatches(): Promise<any[]> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();
  
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name, id), player1:players!player1_id(full_name), player2:players!player2_id(full_name), partner1:players!player3_id(full_name), partner2:players!player4_id(full_name)")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startOfDay)
    .lte("scheduled_at", endOfDay)
    .in("status", ["scheduled", "in_progress"]);

  if (error) throw error;
  return data ?? [];
}

export async function fetchUpcomingPlayerTournamentMatches(playerId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name, id), player1:players!player1_id(full_name), player2:players!player2_id(full_name), partner1:players!player3_id(full_name), partner2:players!player4_id(full_name)")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`)
    .in("status", ["scheduled", "in_progress", "pending"]);

  if (error) throw error;
  return data ?? [];
}

export async function setUserMatchNotification(userId: string, matchId: string, notifyBeforeMins: number): Promise<void> {
  const { error } = await supabase.from("user_match_notifications").upsert({
    user_id: userId,
    match_id: matchId,
    notify_before_mins: notifyBeforeMins,
  }, { onConflict: "user_id, match_id" });
  if (error) throw error;
}

export async function getLiveMatchesFromSiteData(): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from("site_data")
    .select("value")
    .eq("key", "live_matches")
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return (data?.value as Record<string, any>) || {};
}

export async function requestTakeoverLiveMatch(matchId: string, requester: { id: string; name: string }): Promise<void> {
  const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
  if (!data?.value) return;
  const lm = data.value as Record<string, any>;
  if (!lm[matchId]) return;
  lm[matchId].takeoverRequest = {
    requesterId: requester.id,
    requesterName: requester.name,
    status: "pending",
  };
  const { error } = await supabase.from("site_data").upsert({ key: "live_matches", value: lm });
  if (error) throw error;
}

export async function umpireSubmitMatch(params: {
  umpire_id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  winner_id: string;
  match_score: string;
  match_category: string;
  match_round: string;
  is_friendly: boolean;
  sets_history: string[];
  started_at: string;
  ended_at: string;
}): Promise<string | null> {
  const { data, error } = await (supabase.rpc as any)("umpire_submit_match", params);
  if (error) throw error;
  return data as string | null;
}

export async function confirmFriendlyMatch(matchUuid: string, confirmerId: string = "umpire_bypass"): Promise<void> {
  const { error } = await (supabase.rpc as any)("confirm_friendly_match", { match_uuid: matchUuid, confirmer_id: confirmerId });
  if (error) throw error;
}

export async function setMatchAlert(message: string): Promise<void> {
  const { error } = await supabase.from("site_data").upsert({ key: "match_alert", value: { message, time: Date.now() } });
  if (error) throw error;
}

export async function setAdminPush(title: string, body: string, url = "/feed/live"): Promise<void> {
  const { error } = await supabase.from("site_data").upsert(
    { key: "admin_push", value: { title, body, url, timestamp: Date.now() }, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw error;
}

export function subscribeToLiveMatches(callback: (matches: Record<string, any>) => void): () => void {
  const sub = supabase
    .channel("live_matches_channel")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "site_data",
        filter: "key=eq.live_matches",
      },
      (payload) => {
        const newVal = payload.new as { value?: Record<string, unknown> };
        if (newVal?.value) {
          callback(newVal.value as Record<string, unknown>);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(sub);
  };
}

export async function fetchActiveTournamentId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

export async function fetchMatchScoreAndSets(matchId: string): Promise<{ score: string | null; sets_history: string[] | null } | null> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("score, sets_history")
    .eq("id", matchId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function fetchRecentCompletedMatches(params: {
  isTournament: boolean;
  tournamentId?: string;
  limit: number;
}): Promise<any[]> {
  if (params.isTournament) {
    let query = supabase
      .from("tournament_matches")
      .select(`
        id, 
        match_code, 
        rubber_label,
        rubber_order,
        court_number,
        player1_id, 
        player2_id, 
        team1_partner_id:player3_id, 
        team2_partner_id:player4_id, 
        winner_id, 
        winner_side,
        score, 
        sets_history, 
        round:round_name, 
        category, 
        created_at:scored_at,
        scored_at, 
        scored_by,
        team1_label, 
        team2_label, 
        player1:players!player1_id(full_name, gender), 
        player2:players!player2_id(full_name, gender), 
        partner1:players!player3_id(full_name, gender), 
        partner2:players!player4_id(full_name, gender),
        tie:tournament_ties(
          id,
          tie_code,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name),
          team_b:tournament_ties!tournament_ties_team_b_id_fkey(name, short_name)
        )
      `)
      .in("status", ["completed", "walkover"]);

    if (params.tournamentId) {
      query = query.eq("tournament_id", params.tournamentId);
    }

    query = query.order("created_at", { ascending: false }).limit(params.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((m: any) => ({
      ...m,
      created_at: m.scored_at || m.created_at || new Date().toISOString(),
      is_friendly: false,
      is_tournament_match: true,
    }));
  } else {
    const { data, error } = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name, gender), player2:players!player2_id(full_name, gender), partner1:players!team1_partner_id(full_name, gender), partner2:players!team2_partner_id(full_name, gender)")
      .in("status", ["confirmed", "pending"])
      .order("created_at", { ascending: false })
      .limit(params.limit);

    if (error) throw error;
    return data || [];
  }
}

export async function countPendingMatchesForPlayer(playerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .or(`submitted_by.neq.${playerId},submitted_by.is.null`)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},team1_partner_id.eq.${playerId},team2_partner_id.eq.${playerId}`);

  if (error) return 0;
  return count ?? 0;
}

export async function getLiveMatchesAdminList(limit = 10): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from("live_matches")
    .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateLiveMatchStatus(id: string, status: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("live_matches")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLiveMatch(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("live_matches")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchMatchById(id: string): Promise<any> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchLiveFeedMatches(limit = 5): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from("live_matches")
    .select(`
      *,
      player1:players!player1_id(full_name, avatar_url),
      player2:players!player2_id(full_name, avatar_url),
      partner1:players!partner1_id(full_name, avatar_url),
      partner2:players!partner2_id(full_name, avatar_url)
    `)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export function subscribeToLiveFeedMatches(callback: () => void): () => void {
  const channel = supabase
    .channel("live_matches_feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_matches" },
      () => callback(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateLiveMatchScore(matchId: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await (supabase as any)
    .from("live_matches")
    .update(payload as any)
    .eq("id", matchId);
  if (error) throw error;
}

export async function submitFriendlyMatch(params: {
  submitter_id: string;
  opponent_id: string;
  match_winner_id: string;
  match_score: string;
  submitter_partner_id?: string | null;
  opponent_partner_id?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("submit_friendly_match", {
    submitter_id: params.submitter_id,
    opponent_id: params.opponent_id,
    match_winner_id: params.match_winner_id,
    match_score: params.match_score,
    submitter_partner_id: params.submitter_partner_id ?? null,
    opponent_partner_id: params.opponent_partner_id ?? null,
  });
  if (error) throw error;
}

export async function logFriendlyMatch(
  rpcPayload: {
    submitter_id: string;
    opponent_id: string;
    match_winner_id: string;
    match_score: string;
    submitter_partner_id?: string | null;
    opponent_partner_id?: string | null;
  },
  isTournament = false,
  currentUserId?: string
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("submit_friendly_match", rpcPayload);
  if (rpcError) throw rpcError;

  if (isTournament && currentUserId) {
    const { data: latestMatches } = await supabase
      .from("matches")
      .select("id")
      .eq("submitted_by", currentUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestMatches?.length === 1) {
      await supabase.from("matches").update({ is_friendly: false, round: "Tournament" } as any).eq("id", latestMatches[0].id);
    }
  }
}

export async function createLiveMatch(payload: Record<string, unknown>): Promise<void> {
  const { error } = await (supabase as any).from("live_matches").insert(payload as any);
  if (error) throw error;
}

export async function updateMatchVideoUrl(matchId: string, tableName: string, videoUrl: string): Promise<void> {
  const { error } = await (supabase as any)
    .from(tableName)
    .update({ video_url: videoUrl })
    .eq("id", matchId);
  if (error) throw error;
}

export async function fetchMatchReminder(matchId: string, userId: string) {
  const { data, error } = await supabase
    .from("match_reminders")
    .select("remind_before_mins")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setMatchReminder(matchId: string, userId: string, mins: number) {
  const { error } = await supabase
    .from("match_reminders")
    .upsert({
      match_id: matchId,
      user_id: userId,
      remind_before_mins: mins,
      sent_at: null,
    }, { onConflict: "match_id,user_id" });
  if (error) throw error;
}

export async function removeMatchReminder(matchId: string, userId: string) {
  const { error } = await supabase
    .from("match_reminders")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", userId);
  if (error && error.code !== "PGRST116") throw error;
}

export async function updateDefaultMatchReminderMins(userId: string, mins: number | null) {
  const { error } = await supabase
    .from("players")
    .update({ default_match_reminder_mins: mins })
    .eq("id", userId);
  if (error) throw error;
}

export async function setUserMatchAlert(matchId: string, userId: string, notifyBeforeMins: number) {
  const { error } = await supabase.from("user_match_notifications").upsert({
    match_id: matchId,
    user_id: userId,
    notify_before_mins: notifyBeforeMins,
  }, { onConflict: "match_id, user_id" });
  if (error) throw error;
}

export async function removeUserMatchAlert(matchId: string, userId: string) {
  const { error } = await supabase.from("user_match_notifications")
    .delete()
    .eq("match_id", matchId)
    .eq("user_id", userId);
  if (error) throw error;
}

export const matchService = MatchService;





