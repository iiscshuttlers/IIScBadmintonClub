import { supabase } from "@/lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types-auto";
import type { PlayerRow } from "@/types";
import { withAdminPrivate } from "@/services/playerPrivateService";
import { PLAYER_PUBLIC_COLUMNS } from "@/lib/playerColumns";



export const PLAYER_SELECT =
  "id, full_name, nickname, is_guest, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, elo_rating, singles_elo, doubles_elo, mixed_elo, singles_record, doubles_record, mixed_record, tournament_elo, win_loss_record, recent_form, is_looking_to_play, buddies, following, gender, favorite_format, instagram";

type PlayerWithEmails = { id: string; full_name: string; email: string | null; iisc_email: string | null };
type AdminDirectoryPlayer = PlayerWithEmails & { contact_number: string | null; department: string | null };

export const playerService = {
  async getAllPlayers(): Promise<PlayerRow[]> {
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .is("deleted_at", null)
      .order("elo_rating", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as PlayerRow[];
  },

  async getBuddies(profileId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("players")
      .select("buddies")
      .eq("id", profileId)
      .maybeSingle();
    if (error) throw error;
    return data?.buddies ?? [];
  },

  async getFollowers(profileId: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, avatar_url, department, elo_rating, is_looking_to_play, playing_level")
      .contains("following", [profileId])
      .is("deleted_at", null);

    if (error) throw error;
    return data;
  },

  async updateFollowing(userId: string, newFollowingIds: string[]) {
    const { error } = await supabase
      .from("players")
      .update({ following: newFollowingIds })
      .eq("id", userId);
    if (error) throw error;
  },

  async updateLookingToPlay(userId: string, status: boolean) {
    const { error } = await supabase
      .from("players")
      .update({ is_looking_to_play: status })
      .eq("id", userId);
    if (error) throw error;
  },

  /**
   * Sets the availability picker value (looking | playing | resting | injured;
   * the column has a check constraint) and keeps the older is_looking_to_play
   * flag in step, which the directory's "looking to play" filter reads.
   */
  async updatePlayerStatus(userId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("players")
      .update({ status, is_looking_to_play: status === "looking" })
      .eq("id", userId);
    if (error) throw error;
  },

  async fetchPlayer(id: string): Promise<PlayerRow | null> {
    const { data, error } = await supabase.from('players').select(PLAYER_PUBLIC_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data as unknown as PlayerRow | null;
  },

  async fetchPlayerList(): Promise<PlayerRow[]> {
    const { data, error } = await supabase.from('players').select(PLAYER_PUBLIC_COLUMNS).is('deleted_at', null).order('full_name');
    if (error) throw error;
    return (data ?? []) as unknown as PlayerRow[];
  },

  async upsertProfile(userId: string, isEditing: boolean, payload: Partial<PlayerRow>, email?: string): Promise<void> {
    if (isEditing) {
      const { error } = await supabase.from("players").update(payload as unknown as TablesUpdate<"players">).eq("id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("players").insert({
        id: userId,
        email: email,
        ...payload,
      } as unknown as TablesInsert<"players">);
      if (error) throw error;
    }
  },

  async uploadAvatar(userId: string, file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error } = await supabase.storage.from("profiles").upload(filePath, file, { upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from("profiles").getPublicUrl(filePath);
    return data.publicUrl;
  },

  async getActivePlayersForMatching(): Promise<PlayerWithEmails[]> {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name")
      .is("deleted_at", null);
    if (error) throw error;
    // Emails come from the admin-only RPC (empty for non-admins).
    return (await withAdminPrivate(data ?? [])) as PlayerWithEmails[];
  },

  async fetchAdminPlayerDirectory(): Promise<AdminDirectoryPlayer[]> {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, department")
      .is("deleted_at", null);
    if (error) throw error;
    return (await withAdminPrivate(data ?? [])) as AdminDirectoryPlayer[];
  },

  async updatePlayerContact(id: string, contactNumber: string | null): Promise<void> {
    const { error } = await supabase
      .from("players")
      .update({ contact_number: contactNumber })
      .eq("id", id);
    if (error) throw error;
  },

  async getPlayersByIds(ids: string[]): Promise<Array<{ id: string; full_name: string; email: string | null; gender: string | null; is_guest: boolean | null; avatar_url: string | null }>> {
    if (!ids.length) return [];
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, gender, is_guest, avatar_url")
      .in("id", ids);
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; full_name: string; email: string | null; gender: string | null; is_guest: boolean | null; avatar_url: string | null }>;
  },

  /** Names only (id, full_name) for public display: never contact columns. Returns null on error. */
  async getPlayerNamesByIds(ids: string[]) {
    const { data } = await supabase.from("players").select("id, full_name").in("id", ids);
    return data;
  },

  async searchPlayersByQuery(query: string, limit = 10) {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    const { data, error } = await supabase
      .from('players')
      .select('id, full_name, nickname, avatar_url, elo_rating')
      .or(`full_name.ilike.%${q}%,nickname.ilike.%${q}%`)
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getApprovedPlayersSlim() {
    const { data, error } = await supabase
      .from('players')
      .select('id, full_name')
      .eq('is_approved', true)
      .is('deleted_at', null)
      .order('full_name');
    if (error) throw error;
    return data ?? [];
  },

  async getPlayerSubscription(userId: string, playerId: string) {
    const { data, error } = await supabase
      .from("user_player_subscriptions")
      .select("notify_before_mins")
      .eq("user_id", userId)
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async subscribeToPlayer(userId: string, playerId: string, notifyBeforeMins: number) {
    const { error } = await supabase.from("user_player_subscriptions").upsert({
      user_id: userId,
      player_id: playerId,
      notify_before_mins: notifyBeforeMins,
    }, { onConflict: "user_id, player_id" });
    if (error) throw error;
  },

  async unsubscribeFromPlayer(userId: string, playerId: string) {
    const { error } = await supabase.from("user_player_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("player_id", playerId);
    if (error) throw error;
  },

  async fetchDoublesPairData(p1: string, p2: string) {
    const [r1, r2] = await Promise.all([
      supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p1).single(),
      supabase.from("players").select("id,full_name,avatar_url,elo_rating").eq("id", p2).single(),
    ]);

    const { data: rows, error } = await supabase
      .from("tournament_matches")
      .select("id,winner_id,winner_side,player1_id,player2_id,player3_id,player4_id,match_code,score,team1_label,team2_label,status,created_at,scheduled_at,tournaments(name),player1:players!player1_id(full_name),player2:players!player2_id(full_name),player3:players!player3_id(full_name),player4:players!player4_id(full_name)")
      .in("status", ["completed", "walkover"])
      .or(`player1_id.eq.${p1},player3_id.eq.${p1},player2_id.eq.${p1},player4_id.eq.${p1},player1_id.eq.${p2},player3_id.eq.${p2},player2_id.eq.${p2},player4_id.eq.${p2}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return { player1: r1.data, player2: r2.data, rows: rows ?? [] };
  },

  async fetchNotifications(userId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },

  subscribeToNotifications(userId: string, onInsert: (n: Tables<"notifications">) => void) {
    const channel = supabase
      .channel(`notifications_channel_${userId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert(payload.new as Tables<"notifications">)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async markNotificationRead(id: string) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) throw error;
  },

  async markAllNotificationsRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },

  async deleteNotification(id: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw error;
  },

  async clearAllNotifications(userId: string) {
    const { error } = await supabase.from("notifications").delete().eq("user_id", userId);
    if (error) throw error;
  },

  async deleteAccount(params: { userId: string; profileId?: string; userEmail?: string; reason?: string }) {
    await supabase.from("admin_logs").insert({
      admin_email: params.userEmail ?? "unknown",
      action: "user_self_deletion",
      details: params.reason ? `Reason: ${params.reason}` : "No reason given",
    });

    if (params.profileId) {
      await supabase.from("players").delete().eq("id", params.profileId);
    }

    await supabase.from("user_push_tokens").delete().eq("user_id", params.userId);

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.access_token) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ userId: params.userId }),
      }).catch(() => {});
    }
  },

  async fetchSearchPlayers() {
    const { data, error } = await supabase.from("search_players_view").select("id, full_name, avatar_url, department, overall_rank");
    if (error) throw error;
    return data ?? [];
  },

  async fetchSiteDataEntry(key: string) {
    const { data } = await supabase.from("site_data").select("value").eq("key", key).maybeSingle();
    return { data };
  },

  fetchPlayerById(id: string) {
    return this.fetchPlayer(id);
  },
};

export const fetchPlayer = playerService.fetchPlayer;
export const fetchPlayerList = playerService.fetchPlayerList;
export const fetchPlayerById = (id: string) => playerService.fetchPlayer(id);
export const getPlayerSubscription = playerService.getPlayerSubscription;
export const subscribeToPlayer = playerService.subscribeToPlayer;
export const unsubscribeFromPlayer = playerService.unsubscribeFromPlayer;
export const fetchDoublesPairData = playerService.fetchDoublesPairData;
export const fetchNotifications = playerService.fetchNotifications;
export const subscribeToNotifications = playerService.subscribeToNotifications;
export const markNotificationRead = playerService.markNotificationRead;
export const markAllNotificationsRead = playerService.markAllNotificationsRead;
export const deleteNotification = playerService.deleteNotification;
export const clearAllNotifications = playerService.clearAllNotifications;
export const deleteAccount = playerService.deleteAccount;
export const fetchSearchPlayers = playerService.fetchSearchPlayers;
export const fetchSiteDataEntry = playerService.fetchSiteDataEntry;


