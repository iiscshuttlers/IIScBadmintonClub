import { supabase } from "@/lib/supabase";
import type { PlayerRow } from "@/types";



export const PLAYER_SELECT =
  "id, full_name, nickname, department, joined_year, playing_level, playing_style, dominant_hand, avatar_url, current_racket, elo_rating, singles_elo, doubles_elo, mixed_elo, win_loss_record, singles_record, doubles_record, mixed_record, recent_form, is_looking_to_play, status, buddies, following, buddy_requests, gender";

export const playerService = {
  async getAllPlayers(): Promise<PlayerRow[]> {
    const { data, error } = await supabase
      .from("players")
      .select(PLAYER_SELECT)
      .is("deleted_at", null)
      .order("elo_rating", { ascending: false });

    if (error) throw error;
    return data as any as PlayerRow[];
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

  async getBuddyRequests(profileId: string) {
    const { data, error } = await supabase
      .from("buddy_requests")
      .select("id, status, sender_id, receiver_id")
      .or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`);

    if (error) throw error;
    return data;
  },

  async getPendingMatches(profileId: string) {
    const fullRes = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`);
    
    if (!fullRes.error) return fullRes.data || [];

    const fallbackRes = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`);
    
    if (fallbackRes.error) throw fallbackRes.error;
    return fallbackRes.data || [];
  },

  async sendBuddyRequest(senderId: string, receiverId: string) {
    const { error } = await supabase.from("buddy_requests").insert({
      sender_id: senderId,
      receiver_id: receiverId,
    });
    if (error) throw error;
  },

  async cancelBuddyRequest(senderId: string, receiverId: string) {
    const { error } = await supabase.from("buddy_requests")
      .delete()
      .eq("sender_id", senderId)
      .eq("receiver_id", receiverId);
    if (error) throw error;
  },

  async acceptBuddyRequest(senderId: string, receiverId: string) {
    const { error } = await supabase.from("buddy_requests")
      .update({ status: "accepted" })
      .eq("sender_id", senderId)
      .eq("receiver_id", receiverId);
    if (error) throw error;
  },

  async removeBuddy(p1: string, p2: string) {
    const { error } = await supabase.from("buddy_requests")
      .delete()
      .or(`and(sender_id.eq.${p1},receiver_id.eq.${p2}),and(sender_id.eq.${p2},receiver_id.eq.${p1})`);
    if (error) throw error;
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

  async fetchPlayer(id: string) {
    const { data, error } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as any as PlayerRow;
  },

  async fetchPlayerList() {
    const { data, error } = await supabase.from('players').select('*').is('deleted_at', null).order('full_name');
    if (error) throw error;
    return data as any as PlayerRow[];
  }
};

export const fetchPlayer = playerService.fetchPlayer;
export const fetchPlayerList = playerService.fetchPlayerList;
