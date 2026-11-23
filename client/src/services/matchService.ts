import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import type { Json, Tables } from '@/lib/supabase-types-auto';
import type { MatchWithPlayers } from '@/types';
import { MATCH_VIEW_COLUMNS } from '@/lib/matchView';

// live_matches is not in the production schema (missing from the types
// generated on 18 Nov 2026), and updateMatchVideoUrl picks its table at
// runtime. Both go through this untyped client.
const untypedTables = supabase as unknown as SupabaseClient;

/** The date fields the tournament match feeds are sorted by. */
type FeedSortDates = {
  ended_at?: string | null;
  scheduled_at?: string | null;
  date?: string | null;
  created_at?: string | null;
};

/**
 * A player's tournament matches, newest-created first.
 *
 * Reads tournament_matches directly. It used to read player_matches_unified,
 * but since friendly matches were dropped (18 Nov) that view is only a narrow
 * copy of tournament_matches without match_number, match_code, tournament_id,
 * round, court or team labels, so cards showed "Match #undefined" and had no
 * match link. Same rows as the view: these statuses, deleted tournaments out,
 * byes kept (they count in W/L records). RLS is the same, as the view is
 * security_invoker.
 */
export async function fetchPlayerMatches(playerId: string, limit = 200): Promise<MatchWithPlayers[]> {
  const filter = `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`;
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`*, tournaments!inner(status, counts_for_elo), player1:players!player1_id(${playerSelect}), player2:players!player2_id(${playerSelect}), partner1:players!player3_id(${playerSelect}), partner2:players!player4_id(${playerSelect})`)
    .in("status", ["completed", "scheduled", "in_progress", "walkover"])
    .neq("tournaments.status", "deleted")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((m) => ({
    ...m,
    is_friendly: false,
    counts_for_elo: m.tournaments?.counts_for_elo,
    team1_partner_id: m.player3_id,
    team2_partner_id: m.player4_id,
  })) as unknown as MatchWithPlayers[];
}

export async function fetchFeedMatches(
  limit = 100,
  categoryFilter = "all",
  timeFilter = "all",
  tournamentFilter = "all",
): Promise<MatchWithPlayers[]> {
  const playerSelect = "id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo";

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
    tourneyCompletedQuery = tourneyCompletedQuery.eq("tournament_id", tournamentFilter);
    tourneyUpcomingQuery = tourneyUpcomingQuery.eq("tournament_id", tournamentFilter);
  }

  if (/^(MS|WS|MD|WD|XD)$/.test(categoryFilter)) {
    // Exact discipline (MS vs WS), the same rule as the Match Centre.
    const disc = `category.eq.${categoryFilter},match_code.like.${categoryFilter}_%`;
    tourneyCompletedQuery = tourneyCompletedQuery.or(disc);
    tourneyUpcomingQuery = tourneyUpcomingQuery.or(disc);
  } else if (categoryFilter !== "all") {
    if (categoryFilter === "singles") {
      tourneyCompletedQuery = tourneyCompletedQuery.not("category", "ilike", "%Doubles%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.not("category", "ilike", "%Doubles%");
    } else if (categoryFilter === "doubles") {
      tourneyCompletedQuery = tourneyCompletedQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.ilike("category", "%Doubles%").not("category", "ilike", "%Mixed%");
    } else if (categoryFilter === "mixed") {
      tourneyCompletedQuery = tourneyCompletedQuery.ilike("category", "%Mixed%");
      tourneyUpcomingQuery = tourneyUpcomingQuery.ilike("category", "%Mixed%");
    }
  }

  if (timeFilter !== "all") {
    const now = new Date();
    if (timeFilter === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", today);
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", today);
    } else if (timeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", weekAgo.toISOString());
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", weekAgo.toISOString());
    } else if (timeFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      tourneyCompletedQuery = tourneyCompletedQuery.gte("created_at", monthStart);
      tourneyUpcomingQuery = tourneyUpcomingQuery.gte("scheduled_at", monthStart);
    }
  }

    const [
      { data: completedData, error: completedError },
      { data: upcomingData, error: upcomingError }
    ] = await Promise.all([
      tourneyCompletedQuery.order("created_at", { ascending: false }).limit(limit),
      tourneyUpcomingQuery.order("scheduled_at", { ascending: true }).limit(limit)
    ]);
  
    if (completedError) throw completedError;
    if (upcomingError) throw upcomingError;
  
    const mappedTourney = [...(completedData ?? []), ...(upcomingData ?? [])]
      .filter((m) => {
        if (isTournamentSpecific && m.tournament_id !== tournamentFilter) return false;
        const hasTeam1 = m.player1_id || (m.team1_label && !m.team1_label.toLowerCase().includes("bye"));
        const hasTeam2 = m.player2_id || (m.team2_label && !m.team2_label.toLowerCase().includes("bye"));
        return hasTeam1 && hasTeam2;
      })
      .map((m) => ({
        ...m,
        is_friendly: false, counts_for_elo: m.tournaments?.counts_for_elo,
        team1_partner_id: m.player3_id,
        team2_partner_id: m.player4_id,
      }));
  
    const allMatches = [...mappedTourney].sort((a: FeedSortDates, b: FeedSortDates) => {
      const dateA = a.ended_at || a.scheduled_at || a.date || a.created_at;
      const dateB = b.ended_at || b.scheduled_at || b.date || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  
    return allMatches.slice(0, limit) as unknown as MatchWithPlayers[];
  }

import type { BwfMatchState } from "@/types/umpire";

export class MatchService {
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
        match_state: state as Json,
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

  static async fetchFeedMatches(limit = 50) {
    return fetchFeedMatches(limit);
  }
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

/**
 * The raw `site_data` row (`key = live_matches`) holding every live umpire
 * state, or null when it is missing. Unlike getLiveMatchesFromSiteData this
 * never throws: the scoreboard screens treat a failed read like an empty one.
 */
export async function fetchLiveMatchesRow() {
  const { data } = await supabase
    .from("site_data")
    .select("value")
    .eq("key", "live_matches")
    .maybeSingle();
  return data;
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

/** A `score_update` broadcast as sent by MatchService.upsertLiveMatch. */
export type ScoreUpdateBroadcast = {
  type: "broadcast";
  event: string;
  payload: BwfMatchState;
};

/** postgres_changes payload for the `site_data` table. */
export type SiteDataChange = RealtimePostgresChangesPayload<Tables<"site_data">>;

/** postgres_changes payload for the `tournament_matches` table. */
export type TournamentMatchChange = RealtimePostgresChangesPayload<Tables<"tournament_matches">>;

export interface LiveScoreHandlers {
  /** Instant `score_update` broadcast on the screen's broadcast channel. */
  onScoreUpdate: (e: ScoreUpdateBroadcast) => void;
  /** postgres_changes fallback on `site_data` (`key=eq.live_matches`). */
  onLiveMatchesChange: (payload: SiteDataChange) => void;
}

/**
 * TV scoreboard (/tv/:matchId) realtime: an instant broadcast channel plus a
 * postgres_changes fallback on site_data. Returns the cleanup.
 */
export function subscribeToTvScoreboard(matchId: string, handlers: LiveScoreHandlers): () => void {
  // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
  const instantChannel = supabase.channel(`tv_instant_${matchId}`);
  instantChannel
    .on("broadcast", { event: "score_update" }, handlers.onScoreUpdate)
    .subscribe();

  // Channel 2: Postgres Changes fallback (site_data updates)
  const sub = supabase
    .channel(`tv_scoreboard_${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "site_data",
        filter: "key=eq.live_matches",
      },
      handlers.onLiveMatchesChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(instantChannel);
    supabase.removeChannel(sub);
  };
}

/**
 * OBS overlay realtime: an instant broadcast channel plus a postgres_changes
 * fallback on site_data. Returns the cleanup.
 */
export function subscribeToObsOverlay(handlers: LiveScoreHandlers): () => void {
  // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
  const instantChannel = supabase.channel("obs_instant_scores");
  instantChannel
    .on("broadcast", { event: "score_update" }, handlers.onScoreUpdate)
    .subscribe();

  // Channel 2: Postgres Changes fallback (site_data updates)
  const sub = supabase
    .channel("obs_overlay_live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
      handlers.onLiveMatchesChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(instantChannel);
    supabase.removeChannel(sub);
  };
}

export interface CameraBroadcastHandlers extends LiveScoreHandlers {
  /** postgres_changes on the selected `tournament_matches` row. */
  onMatchChange: (payload: TournamentMatchChange) => void;
}

/**
 * Camera broadcast realtime for the selected match: the shared
 * `court_live_scores` broadcast channel, site_data live_matches changes and
 * changes to the tournament_matches row. Returns the cleanup.
 */
export function subscribeToCameraBroadcast(selectedMatchId: string, handlers: CameraBroadcastHandlers): () => void {
  // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
  const instantBroadcastChannel = supabase.channel("court_live_scores");
  instantBroadcastChannel
    .on("broadcast", { event: "score_update" }, handlers.onScoreUpdate)
    .subscribe();

  // Channel 2: Listen to live_matches in site_data DB
  const siteDataChannel = supabase
    .channel(`camera_sitedata_${selectedMatchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
      handlers.onLiveMatchesChange
    )
    .subscribe();

  // Channel 3: Listen to tournament_matches table DB
  const tmChannel = supabase
    .channel(`camera_tm_${selectedMatchId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_matches", filter: `id=eq.${selectedMatchId}` },
      handlers.onMatchChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(instantBroadcastChannel);
    supabase.removeChannel(siteDataChannel);
    supabase.removeChannel(tmChannel);
  };
}

/**
 * Home rail: matches selected by `orClauses` (followed players / tournaments)
 * that are live or upcoming, or ended at or after `sinceIso`, with the
 * tournament name; earliest scheduled first, at most 200. Throws on error.
 */
export async function fetchHomeRailMatches(orClauses: string, sinceIso: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`${MATCH_VIEW_COLUMNS}, tournaments(name)`)
    .or(orClauses)
    // Live or upcoming, or finished within the recent window.
    .or(`status.in.(in_progress,playing,live,ongoing,scheduled,pending),ended_at.gte.${sinceIso}`)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return data;
}

/**
 * Records book: rows [from, to] (by id) of finished matches whose tournament
 * is not draft, cancelled or deleted, with that tournament. Throws on error.
 */
export async function fetchRecordsBookPage(from: number, to: number) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`${MATCH_VIEW_COLUMNS}, tournaments!inner(id, name, status, counts_for_elo)`)
    .in("status", ["completed", "finished", "walkover"])
    .not("tournaments.status", "in", "(draft,cancelled,deleted)")
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return data;
}

const H2H_HISTORY_COLUMNS =
  "id, status, winner_side, player1_id, player2_id, player3_id, player4_id, score, ended_at, scheduled_at, category, tournaments(name)";

/**
 * Completed or walkover matches in which any of `playerIds` played, most
 * recently ended first, at most 300 (match H2H tab). Throws on error.
 */
export async function fetchH2HHistoryMatches(playerIds: string[]) {
  const list = playerIds.join(",");
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(H2H_HISTORY_COLUMNS)
    .in("status", ["completed", "walkover"])
    .or(`player1_id.in.(${list}),player2_id.in.(${list}),player3_id.in.(${list}),player4_id.in.(${list})`)
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  return data;
}

/** Completed or walkover matches umpired by `playerId`, with the tournament name, at most 1000. Throws on error. */
export async function fetchUmpiredMatches(playerId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, tournament_id, category, round_name, team1_label, team2_label, score, status, started_at, ended_at, scheduled_at, tournaments(name)")
    .eq("umpired_by", playerId)
    .in("status", ["completed", "walkover"])
    .limit(1000);
  if (error) throw error;
  return data;
}

/**
 * The server copy of a match's point log (`points` only), or null when there
 * is no row or the read fails (it never throws: recovery treats it as optional).
 */
export async function fetchStoredPointLog(matchId: string) {
  const { data } = await supabase
    .from("tournament_match_point_logs")
    .select("points")
    .eq("match_id", matchId)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));
  return data;
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
        best_of_sets,
        points_to_win,
        golden_point,
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
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name)
        )
      `)
      .in("status", ["completed", "walkover"]);

    if (params.tournamentId) {
      query = query.eq("tournament_id", params.tournamentId);
    }

    query = query.order("created_at", { ascending: false }).limit(params.limit);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((m) => ({
      ...m,
      created_at: m.scored_at || m.created_at || new Date().toISOString(),
      is_friendly: false,
      is_tournament_match: true,
    }));
  }
  // Only tournament submissions exist; friendly matches were removed.
  return [];
}

export async function getLiveMatchesAdminList(limit = 10): Promise<any[]> {
  const { data, error } = await untypedTables
    .from("live_matches")
    .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updateLiveMatchStatus(id: string, status: string): Promise<void> {
  const { error } = await untypedTables
    .from("live_matches")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLiveMatch(id: string): Promise<void> {
  const { error } = await untypedTables
    .from("live_matches")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchLiveFeedMatches(limit = 5): Promise<any[]> {
  const { data, error } = await untypedTables
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
  const { error } = await untypedTables
    .from("live_matches")
    .update(payload)
    .eq("id", matchId);
  if (error) throw error;
}

export async function createLiveMatch(payload: Record<string, unknown>): Promise<void> {
  const { error } = await untypedTables.from("live_matches").insert(payload);
  if (error) throw error;
}

export async function updateMatchVideoUrl(matchId: string, tableName: string, videoUrl: string): Promise<void> {
  const { error } = await untypedTables
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





