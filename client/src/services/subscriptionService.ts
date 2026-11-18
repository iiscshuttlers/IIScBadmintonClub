import { supabase } from "@/lib/supabase";

export interface TournamentSubscription {
  id: string;
  user_id: string;
  tournament_id: string;
  notify_match_call: boolean;
  notify_schedule_change: boolean;
  notify_result: boolean;
  is_muted: boolean;
  created_at: string;
  tournaments?: {
    id: string;
    name: string;
    venue: string | null;
    status: string | null;
    start_date: string | null;
  };
}

export interface PlayerSubscription {
  id: string;
  user_id: string;
  player_id: string;
  notify_before_mins: number;
  notify_match_call: boolean;
  notify_schedule_change: boolean;
  notify_result: boolean;
  is_muted: boolean;
  created_at: string;
  players?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    department: string | null;
    elo_rating: number | null;
  };
}

export interface MatchSubscription {
  id: string;
  user_id: string;
  match_id: string;
  notify_before_mins: number;
  created_at: string;
  tournament_matches?: {
    id: string;
    tournament_id: string;
    team1_label: string | null;
    team2_label: string | null;
    scheduled_at: string | null;
    category: string | null;
    match_code: string | null;
    round_name: string | null;
  };
}

export interface FollowingMatchesResponse {
  live: any[];
  upcoming: any[];
  completed: any[];
  all: any[];
}

export const subscriptionService = {
  async fetchTournamentSubscriptions(userId: string): Promise<TournamentSubscription[]> {
    const { data, error } = await supabase
      .from("user_tournament_subscriptions" as any)
      .select("*, tournaments(id, name, venue, status, start_date)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Table may be absent if migration hasn't run yet; return graceful empty list
      console.warn("fetchTournamentSubscriptions error", error);
      return [];
    }
    return (data ?? []) as unknown as TournamentSubscription[];
  },

  async isFollowingTournament(userId: string, tournamentId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("user_tournament_subscriptions" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  },

  async followTournament(
    userId: string,
    tournamentId: string,
    options?: Partial<Omit<TournamentSubscription, "id" | "user_id" | "tournament_id">>
  ): Promise<void> {
    const payload = {
      user_id: userId,
      tournament_id: tournamentId,
      notify_match_call: options?.notify_match_call ?? true,
      notify_schedule_change: options?.notify_schedule_change ?? true,
      notify_result: options?.notify_result ?? true,
      is_muted: options?.is_muted ?? false,
    };

    const { error } = await supabase
      .from("user_tournament_subscriptions" as any)
      .upsert(payload, { onConflict: "user_id,tournament_id" });

    if (error) throw error;
  },

  async unfollowTournament(userId: string, tournamentId: string): Promise<void> {
    const { error } = await supabase
      .from("user_tournament_subscriptions" as any)
      .delete()
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId);

    if (error) throw error;
  },

  async updateTournamentSubscription(
    userId: string,
    tournamentId: string,
    updates: Partial<
      Pick<
        TournamentSubscription,
        "notify_match_call" | "notify_schedule_change" | "notify_result" | "is_muted"
      >
    >
  ): Promise<void> {
    const { error } = await supabase
      .from("user_tournament_subscriptions" as any)
      .update(updates)
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId);

    if (error) throw error;
  },

  async fetchPlayerSubscriptions(userId: string): Promise<PlayerSubscription[]> {
    const { data, error } = await supabase
      .from("user_player_subscriptions")
      .select("*, players(id, full_name, avatar_url, department, elo_rating)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as PlayerSubscription[];
  },

  async updatePlayerSubscription(
    userId: string,
    playerId: string,
    updates: Partial<
      Pick<
        PlayerSubscription,
        "notify_before_mins" | "notify_match_call" | "notify_schedule_change" | "notify_result" | "is_muted"
      >
    >
  ): Promise<void> {
    const { error } = await (supabase.from("user_player_subscriptions") as any)
      .update(updates)
      .eq("user_id", userId)
      .eq("player_id", playerId);

    if (error) throw error;
  },

  async unfollowPlayer(userId: string, playerId: string): Promise<void> {
    const { error } = await supabase
      .from("user_player_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("player_id", playerId);

    if (error) throw error;
  },

  async fetchFollowingMatches(userId: string, followingPlayerIds: string[] = []): Promise<FollowingMatchesResponse> {
    // 1. Get followed tournament IDs
    const tournamentSubs = await this.fetchTournamentSubscriptions(userId);
    const followedTournamentIds = tournamentSubs.map((s) => s.tournament_id);

    // 2. Combine player IDs from user_player_subscriptions and following array
    const playerSubs = await this.fetchPlayerSubscriptions(userId);
    const subPlayerIds = playerSubs.map((s) => s.player_id);
    const allPlayerIds = Array.from(new Set([...followingPlayerIds, ...subPlayerIds]));

    if (followedTournamentIds.length === 0 && allPlayerIds.length === 0) {
      return { live: [], upcoming: [], completed: [], all: [] };
    }

    // 3. Query tournament matches
    let query = supabase
      .from("tournament_matches")
      .select(
        "id, tournament_id, category, round_name, match_number, match_code, court_number, scheduled_at, status, score, winner_side, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url), player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url), tournaments(id, name, venue, status)"
      )
      .order("scheduled_at", { ascending: true });

    const { data: rawMatches, error } = await query;
    if (error || !rawMatches) {
      return { live: [], upcoming: [], completed: [], all: [] };
    }

    const tIdSet = new Set(followedTournamentIds);
    const pIdSet = new Set(allPlayerIds);

    const relevant = rawMatches.filter((m: any) => {
      if (tIdSet.has(m.tournament_id)) return true;
      if (
        (m.player1_id && pIdSet.has(m.player1_id)) ||
        (m.player2_id && pIdSet.has(m.player2_id)) ||
        (m.player3_id && pIdSet.has(m.player3_id)) ||
        (m.player4_id && pIdSet.has(m.player4_id))
      ) {
        return true;
      }
      return false;
    });

    const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);
    const live: any[] = [];
    const upcoming: any[] = [];
    const completed: any[] = [];

    for (const m of relevant) {
      if (LIVE_STATUSES.has(m.status)) {
        live.push(m);
      } else if (m.status === "completed" || m.status === "walkover") {
        completed.push(m);
      } else {
        upcoming.push(m);
      }
    }

    // Sort completed by most recent first
    completed.sort((a, b) => {
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return tb - ta;
    });

    return {
      live,
      upcoming,
      completed,
      all: [...live, ...upcoming, ...completed],
    };
  },
};

