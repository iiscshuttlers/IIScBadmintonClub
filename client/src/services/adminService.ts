import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { PlayerRow } from "@/types";
import type { Database, Json, TablesInsert } from "@/lib/supabase-types-auto";
import { withAdminPrivate } from "@/services/playerPrivateService";

// Untyped access for table names chosen at runtime (exportTable,
// restoreRecycleBinItem) and for broadcast_history, which is also missing from
// the production schema (its insert result was never checked).
const untypedTables = supabase as unknown as SupabaseClient;

export interface AdminLogEntry {
  id: number;
  admin_email: string;
  action: string;
  details?: string | Record<string, unknown> | null;
  created_at: string;
}

export interface GuestRow {
  id: string;
  full_name: string;
  gender: string | null;
  elo_rating: number | null;
  total_friendly_matches: number | null;
  created_at: string;
}

/** Response of the send-announcement edge function. */
export interface PushBroadcastResult {
  sent?: number;
  failed?: number;
  total?: number;
}

export interface PendingGuestMatch {
  id: string;
  created_at: string;
  score: string;
  category: string;
  winner_id: string;
  player1: { id: string; full_name: string; is_guest?: boolean } | null;
  player2: { id: string; full_name: string; is_guest?: boolean } | null;
  partner1?: { id: string; full_name: string; is_guest?: boolean } | null;
  partner2?: { id: string; full_name: string; is_guest?: boolean } | null;
}

export const adminService = {
  async logAction(action: string, details?: string | Record<string, unknown> | null, adminEmail = "admin"): Promise<void> {
    const { error } = await supabase.from("admin_logs").insert({
      admin_email: adminEmail,
      action,
      details: details as unknown as Json,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to insert admin log:", error);
    }
  },

  async getLogs(pageNum = 0, pageSize = 50): Promise<AdminLogEntry[]> {
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

    if (error) throw error;
    return (data ?? []) as AdminLogEntry[];
  },

  async recalculateAllElo(): Promise<void> {
    const { error } = await supabase.rpc("recalculate_all_elo");
    if (error) throw error;
  },

  async getEloAuditData() {
    const [logsRes, playersRes, matchesRes, tourneyMatchesRes, recentLogsRes] = await Promise.all([
      supabase
        .from("admin_logs")
        .select("id, admin_email, action, details, created_at")
        .ilike("action", "elo%")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("players")
        .select("id, full_name, elo_rating, singles_elo, doubles_elo, mixed_elo, gender, department, singles_matches_played, doubles_matches_played, mixed_matches_played")
        .order("elo_rating", { ascending: false }),
      supabase
        .from("matches")
        .select("player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id")
        .in("status", ["confirmed", "walkover"]),
      supabase
        .from("tournament_matches")
        .select("id, player1_id, player2_id, player3_id, player4_id, winner_id, winner_side, match_number, match_code, category, created_at")
        .eq("status", "completed"),
      supabase
        .from("elo_calculation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (logsRes.error) throw logsRes.error;
    if (playersRes.error) throw playersRes.error;
    if (matchesRes.error) throw matchesRes.error;
    if (tourneyMatchesRes.error) throw tourneyMatchesRes.error;

    return {
      logs: logsRes.data || [],
      players: (playersRes.data || []) as unknown as PlayerRow[],
      matches: matchesRes.data || [],
      tourneyMatches: tourneyMatchesRes.data || [],
      recentLogs: recentLogsRes.data || [],
    };
  },

  async getPlayerEloHistory(playerId: string) {
    const { data: logData, error: logErr } = await supabase
      .from("elo_calculation_logs")
      .select("*")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (logErr) throw logErr;
    if (!logData || logData.length === 0) return { logs: [], matches: {}, tourneyMatches: {} };

    const matchIds = [...new Set(logData.map((l) => l.match_uuid).filter(Boolean))];
    let allLogsData: Array<Record<string, unknown>> = [];
    if (matchIds.length > 0) {
      const { data } = await supabase
        .from("elo_calculation_logs")
        .select("*")
        .in("match_uuid", matchIds);

      if (data) {
        const playerIdsToFetch = [...new Set(data.map((l) => l.player_id).filter(Boolean))];
        const { data: playersData } = await supabase
          .from("players")
          .select("id, full_name")
          .in("id", playerIdsToFetch);

        const playersMap: Record<string, { id: string; full_name: string }> = {};
        (playersData || []).forEach((p) => {
          playersMap[p.id] = p;
        });

        allLogsData = data.map((l) => ({
          ...l,
          player: playersMap[l.player_id] || { id: l.player_id, full_name: "Unknown" },
        }));
      }
    }

    const { data: matchData } = await supabase
      .from("matches")
      .select(`
        id, score, category, created_at,
        player1:players!player1_id(id, full_name),
        player2:players!player2_id(id, full_name),
        partner1:players!team1_partner_id(id, full_name),
        partner2:players!team2_partner_id(id, full_name),
        player1_id, player2_id, team1_partner_id, team2_partner_id
      `)
      .in("id", matchIds);

    const { data: tourneyMatchData } = await supabase
      .from("tournament_matches")
      .select(`
        id, category, created_at, match_number, match_code,
        player1:players!player1_id(id, full_name),
        player2:players!player2_id(id, full_name),
        player3:players!player3_id(id, full_name),
        player4:players!player4_id(id, full_name),
        player1_id, player2_id, player3_id, player4_id
      `)
      .in("id", matchIds);

    return {
      logData: logData || [],
      allLogsData,
      matchData: matchData || [],
      tourneyMatchData: tourneyMatchData || [],
    };
  },

  async approvePlayers(ids: string[], approved: boolean): Promise<void> {
    const { error } = await supabase.rpc("admin_approve_players", {
      p_ids: ids,
      p_approved: approved,
    });
    if (error) throw error;
  },

  async updatePlayerRole(playerId: string, role: string): Promise<void> {
    const { error } = await supabase.rpc("set_player_role", {
      p_id: playerId,
      p_role: role,
    });
    if (error) {
      // Fallback direct update if RPC is missing
      const { error: directErr } = await supabase
        .from("players")
        .update({ role })
        .eq("id", playerId);
      if (directErr) throw directErr;
    }
  },

  async updatePlayerRetirement(playerId: string, isRetired: boolean): Promise<void> {
    const { data, error } = await supabase
      .from("players")
      .update({ is_retired: isRetired })
      .eq("id", playerId)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Permission Denied: Database RLS policy blocked the update.");
    }
  },

  async getGuestPlayers(): Promise<GuestRow[]> {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, gender, elo_rating, total_friendly_matches, created_at")
      .eq("is_guest", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as GuestRow[];
  },

  async createGuestPlayer(name: string, gender?: "Male" | "Female" | ""): Promise<PlayerRow> {
    const { data, error } = await supabase
      .from("players")
      .insert({
        full_name: name.trim(),
        gender: gender || null,
        is_guest: true,
        department: "Guest",
        playing_level: "Intermediate",
        playing_style: "All-Rounder",
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
        current_racket: "Standard Club Racket",
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PlayerRow;
  },

  async createGuestPlayerRpc(
    name: string,
    gender?: string | null,
  ): Promise<Database["public"]["Functions"]["create_guest_player"]["Returns"]> {
    const { data, error } = await supabase.rpc("create_guest_player", { p_full_name: name.trim(), p_gender: gender || null });
    if (error) throw error;
    return data;
  },

  async getPendingGuestMatches(): Promise<PendingGuestMatch[]> {
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, created_at, score, category, winner_id, " +
          "player1:players!player1_id(id,full_name,is_guest), " +
          "player2:players!player2_id(id,full_name,is_guest), " +
          "partner1:players!team1_partner_id(id,full_name,is_guest), " +
          "partner2:players!team2_partner_id(id,full_name,is_guest)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const matches = ((data as unknown as PendingGuestMatch[]) ?? []).filter((row) =>
      [row.player1, row.player2, row.partner1, row.partner2].some((p) => p?.is_guest),
    );
    return matches;
  },

  async claimGuestPlayer(guestId: string, realPlayerId: string): Promise<void> {
    const { error } = await supabase.rpc("claim_guest_player", {
      p_guest_id: guestId,
      p_real_player_id: realPlayerId,
    });
    if (error) throw error;
  },

  async rejectGuestMatch(matchId: string): Promise<void> {
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) throw error;
  },

  async getRealApprovedPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, department")
      .eq("is_approved", true)
      .or("is_guest.is.null,is_guest.eq.false")
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  },

  async getPlayersForAdmin(): Promise<any[]> {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, department, is_approved, created_at, stats, role, is_retired, gender")
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Contact columns are admin-only and come from a checked RPC.
    return withAdminPrivate(data ?? []);
  },

  async bulkRetirePlayers(ids: string[], retired: boolean): Promise<void> {
    const { error } = await supabase
      .from("players")
      .update({ is_retired: retired })
      .in("id", ids);
    if (error) throw error;
  },

  async getUnlinkedExternalLabels() {
    const [{ data: t1 }, { data: t2 }, { data: tp }] = await Promise.all([
      supabase
        .from("tournament_matches")
        .select("team1_label, tournament_id, tournaments(name)")
        .not("team1_label", "is", null)
        .is("player1_id", null),
      supabase
        .from("tournament_matches")
        .select("team2_label, tournament_id, tournaments(name)")
        .not("team2_label", "is", null)
        .is("player2_id", null),
      supabase
        .from("tournament_participants")
        .select("display_name")
        .not("display_name", "is", null)
        .is("player_id", null),
    ]);
    return { t1: t1 ?? [], t2: t2 ?? [], tp: tp ?? [] };
  },

  async getClubSettings(): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "club_settings")
      .maybeSingle();
    if (error) throw error;
    return (data?.value as Record<string, unknown>) ?? null;
  },

  async saveClubSettings(settings: Record<string, unknown>, adminEmail = "admin"): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert(
        { key: "club_settings", value: settings as Json, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
    await adminService.logAction("Updated club settings", undefined, adminEmail);
  },

  async saveAppVersion(versionData: Record<string, unknown>, adminEmail = "admin", nextVersion?: number): Promise<void> {
    const { error } = await supabase
      .from("site_data")
      .upsert(
        { key: "app_version", value: versionData as Json, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw error;
    await supabase.functions.invoke("send-announcement", {
      body: {
        title: "Update Available",
        body: "A new version of IISc Badminton Club is available! Please open the app to update.",
        data_type: "app_update",
      },
    });
    await adminService.logAction(
      `Forced app update prompt (v${nextVersion ?? "latest"})`,
      undefined,
      adminEmail,
    );
  },

  async exportTable(tableName: string): Promise<Record<string, Json>[]> {
    const { data, error } = await untypedTables.from(tableName).select("*");
    if (error) throw error;
    return data ?? [];
  },

  async getNotificationQueueStats(): Promise<{ unsent: number; sent: number }> {
    const [unsentRes, sentRes] = await Promise.all([
      supabase.from("notification_queue").select("id", { count: "exact", head: true }).eq("sent", false),
      supabase.from("notification_queue").select("id", { count: "exact", head: true }).eq("sent", true),
    ]);
    return { unsent: unsentRes.count ?? 0, sent: sentRes.count ?? 0 };
  },

  async clearSentNotifications(): Promise<void> {
    const { error } = await supabase.from("notification_queue").delete().eq("sent", true);
    if (error) throw error;
  },

  async flushNotificationQueue(): Promise<void> {
    const { error } = await supabase.functions.invoke("batch-notifications");
    if (error) throw error;
  },

  async verifyDbBackups(): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase.functions.invoke<Record<string, unknown>>("verify-db-backups");
    if (error) throw error;
    return data;
  },

  async invokePublicApi(path: string): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke<unknown>("public-api" + path);
    if (error) throw error;
    return data;
  },

  async submitUserFeedback(userId: string, type: string, message: string): Promise<void> {
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      feedback_type: type,
      message: message.trim(),
      status: "new",
    });
    if (error) throw error;
  },

  async fetchAdminStats(since7d: string) {
    const [playersRes, matchesRes, weekMatchesRes, pendingMatchRes, pendingPlayersRes] =
      await Promise.all([
        supabase.from("players").select("id, full_name, elo_rating, is_approved").is("deleted_at", null),
        supabase.from("matches").select("id", { count: "exact", head: true }).in("status", ["confirmed", "walkover"]),
        supabase.from("matches").select("id, player1_id, player2_id, elo_change_p1, elo_change_p2, created_at").in("status", ["confirmed", "walkover"]).gte("created_at", since7d),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("players").select("id", { count: "exact", head: true }).eq("is_approved", false).is("deleted_at", null),
      ]);

    return {
      players: playersRes.data ?? [],
      matchesCount: matchesRes.count ?? 0,
      weekMatches: weekMatchesRes.data ?? [],
      pendingMatchesCount: pendingMatchRes.count ?? 0,
      pendingPlayersCount: pendingPlayersRes.count ?? 0,
    };
  },

  async fetchDisputedMatches(): Promise<any[]> {
    const { data, error } = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(id,full_name,avatar_url), player2:players!player2_id(id,full_name,avatar_url), partner1:players!team1_partner_id(id,full_name,avatar_url), partner2:players!team2_partner_id(id,full_name,avatar_url)")
      .eq("status", "disputed")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async resolveDispute(matchId: string, action: "uphold" | "override", newWinnerId?: string): Promise<void> {
    if (action === "uphold") {
      const { error } = await supabase.from("matches").update({ status: "confirmed", dispute_reason: null } as any).eq("id", matchId);
      if (error) throw error;
    } else if (action === "override" && newWinnerId) {
      const { error } = await supabase.from("matches").update({ status: "confirmed", winner_id: newWinnerId, dispute_reason: null } as any).eq("id", matchId);
      if (error) throw error;
    }
  },

  async fetchRecycleBin(): Promise<any[]> {
    const { data, error } = await supabase
      .from("recycle_bin")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("deleted_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async restoreRecycleBinItem(item: { id: string; table_name: string; record_data: Json }): Promise<void> {
    const { error } = await untypedTables.from(item.table_name).insert(item.record_data);
    if (error) throw error;
    const { error: delErr } = await supabase.from("recycle_bin").delete().eq("id", item.id);
    if (delErr) throw delErr;
  },

  async deleteRecycleBinItem(id: string): Promise<void> {
    const { error } = await supabase.from("recycle_bin").delete().eq("id", id);
    if (error) throw error;
  },

  async sendPushBroadcast(payload: {
    title: string;
    body: string;
    url?: string;
    admin_email: string;
    showOnHome?: boolean;
  }): Promise<PushBroadcastResult | null> {
    const { data: fnData, error: fnError } = await supabase.functions.invoke<PushBroadcastResult>("send-announcement", {
      body: {
        title: payload.title.trim(),
        body: payload.body.trim() || payload.title.trim(),
        admin_email: payload.admin_email,
      },
    });
    if (fnError) throw fnError;

    const sitePayload = {
      title: payload.title.trim(),
      body: payload.body.trim(),
      url: payload.url?.trim() || "",
      timestamp: Date.now(),
    };
    await supabase.from("site_data").upsert(
      { key: "admin_push", value: sitePayload, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    if (payload.showOnHome) {
      const { data: bData } = await supabase.from("site_data").select("value").eq("key", "home_banners").maybeSingle();
      const existingBanners = (bData?.value as { banners?: Json[] } | null)?.banners || (Array.isArray(bData?.value) ? bData?.value : []);
      const newBanner = {
        id: `broadcast_${Date.now()}`,
        type: "custom",
        title: payload.title.trim(),
        message: payload.body.trim(),
        color: "amber",
        link_url: payload.url?.trim() || undefined,
        link_label: "View",
        active: true,
        pinned: false,
      };
      await supabase.from("site_data").upsert(
        { key: "home_banners", value: { banners: [...existingBanners, newBanner] }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    await untypedTables.from("broadcast_history").insert({
      title: payload.title.trim(),
      body: payload.body.trim(),
      url: payload.url?.trim() || null,
      sent_by: payload.admin_email,
      recipient_count: fnData?.total ?? fnData?.sent ?? 0,
      success_count: fnData?.sent ?? 0,
    });

    return fnData;
  },

  async queueScheduledNotification(row: TablesInsert<"scheduled_notifications">): Promise<void> {
    const { error } = await supabase.from("scheduled_notifications").insert(row);
    if (error) throw error;
  },

  async createInAppNotifications(rows: TablesInsert<"notifications">[]): Promise<void> {
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) throw error;
  },

  async deleteGuestPlayer(guestId: string): Promise<void> {
    const { error } = await supabase.rpc("delete_guest_player", { p_guest_id: guestId });
    if (error) throw error;
  },

  async mergeGuestPlayer(guestId: string, realId: string): Promise<void> {
    const { error } = await supabase.rpc("merge_guest_player", {
      guest_id: guestId,
      real_id: realId,
    });
    if (error) throw error;
  },

  async linkLabelToPlayer(params: {
    p_source_table: string;
    p_record_id: string;
    p_slot: string;
    p_player_id: string;
    p_is_partner?: boolean;
  }): Promise<any> {
    const { data, error } = await (supabase.rpc as any)("link_label_to_player", params);
    if (error) throw error;
    return data;
  },

  async getTournamentSiteConfig(): Promise<Json | null> {
    const { data, error } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "tournament_config")
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  },

  async saveTournamentSiteConfig(config: unknown): Promise<void> {
    const { error } = await supabase.from("site_data").upsert(
      { key: "tournament_config", value: config as Json },
      { onConflict: "key" }
    );
    if (error) throw error;
  },

  async fetchAdminStatsOverview() {
    const startTime = performance.now();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [playersRes, matchesRes, weekMatchesRes, pendingMatchRes, pendingPlayersRes] =
      await Promise.all([
        supabase.from("players").select("id, full_name, elo_rating, is_approved").is("deleted_at", null),
        supabase.from("matches").select("id", { count: "exact", head: true }).in("status", ["confirmed", "walkover"]),
        supabase.from("matches").select("id, player1_id, player2_id, elo_change_p1, elo_change_p2, created_at").in("status", ["confirmed", "walkover"]).gte("created_at", since7d),
        supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("players").select("id", { count: "exact", head: true }).eq("is_approved", false).is("deleted_at", null),
      ]);

    if (playersRes.error) throw playersRes.error;
    if (weekMatchesRes.error) throw weekMatchesRes.error;

    return {
      players: playersRes.data ?? [],
      totalMatchesCount: matchesRes.count ?? 0,
      weekMatches: weekMatchesRes.data ?? [],
      pendingMatchesCount: pendingMatchRes.count ?? 0,
      pendingPlayersCount: pendingPlayersRes.count ?? 0,
      dbLatency: Math.round(performance.now() - startTime),
    };
  },

  async fetchDisputes() {
    return this.fetchDisputedMatches();
  },

  async fetchRecycleBinItems() {
    return this.fetchRecycleBin();
  },

  async confirmFriendlyMatch(matchUuid: string, confirmerId = "umpire_bypass") {
    const { error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchUuid, confirmer_id: confirmerId });
    if (error) throw error;
  },

  async recalculateTournamentElo() {
    const { error } = await supabase.rpc("recalculate_tournament_elo");
    if (error) throw error;
  },

  async linkLabelToPlayerDoubles(label: string, playerId: string, partnerId: string | null) {
    const { data, error } = await supabase.rpc("link_label_to_player", {
      p_label: label,
      p_player_id: playerId,
      p_partner_id: partnerId,
    });
    if (error) throw error;
    return data;
  },

  async fetchAuthUsers(): Promise<any[]> {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));
    const funcRes = await Promise.race([
      supabase.functions.invoke<{ users?: unknown[] }>("admin-users", { method: "GET" }),
      timeout,
    ]);
    if (funcRes.error) throw funcRes.error;
    return funcRes.data?.users ?? [];
  },

  async deleteAuthUser(userId: string): Promise<void> {
    const { error } = await supabase.functions.invoke("admin-users", {
      method: "DELETE",
      body: { userId },
    });
    if (error) throw error;
  },

  async verifyAuthUser(userId: string): Promise<void> {
    const { error } = await supabase.functions.invoke("admin-users", {
      method: "POST",
      body: { action: "verify", userId },
    });
    if (error) throw error;
  },

  async resendAuthVerification(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw error;
  },

  async fetchTournamentTeamGuests(tournamentId: string) {
    const [{ data: memberData, error: mErr }, { data: teamsData, error: tErr }] = await Promise.all([
      supabase
        .from("tournament_team_members")
        .select("player:players!player_id(id, full_name, created_at, is_guest)")
        .eq("tournament_id", tournamentId)
        .eq("status", "ACTIVE"),
      supabase
        .from("tournament_teams")
        .select("captain:players!captain_id(id, full_name, created_at, is_guest)")
        .eq("tournament_id", tournamentId),
    ]);
    if (mErr) throw mErr;
    if (tErr) throw tErr;

    const guestMap = new Map<string, any>();
    memberData?.forEach((row) => {
      const p = row.player;
      if (p && p.id && !guestMap.has(p.id)) {
        guestMap.set(p.id, p);
      }
    });
    teamsData?.forEach((row) => {
      const p = row.captain;
      if (p && p.id && !guestMap.has(p.id)) {
        guestMap.set(p.id, p);
      }
    });

    const playerIds = Array.from(guestMap.keys());
    if (playerIds.length === 0) return [];

    const { data: guestProfiles, error: pErr } = await supabase
      .from("players")
      .select("id, full_name, is_guest, created_at")
      .in("id", playerIds)
      .eq("is_guest", true);
    if (pErr) throw pErr;
    return withAdminPrivate(guestProfiles || []);
  },

  async fetchCandidatePlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, is_guest, elo_rating, nickname")
      .eq("is_guest", false)
      .is("deleted_at", null);
    if (error) throw error;
    return withAdminPrivate(data || []);
  },
};
