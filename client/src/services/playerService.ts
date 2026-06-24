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

  async getOtherPlayersSlim(currentUserId: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, avatar_url, gender, is_guest")
      .neq("id", currentUserId)
      .is("deleted_at", null)
      .order("full_name");
    
    if (error) throw error;
    return data;
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
  },

  async upsertProfile(userId: string, isEditing: boolean, payload: any, email?: string) {
    if (isEditing) {
      const { error } = await supabase.from("players").update(payload).eq("id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("players").insert({
        id: userId,
        email: email,
        ...payload,
      });
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
  }
};

export const fetchPlayer = playerService.fetchPlayer;
export const fetchPlayerList = playerService.fetchPlayerList;

export function formatPlayerData(data: any): import("@/types").PlayerProfileType {
  const parseShoesList = (shoes: string | null) => {
    if (!shoes) return [];
    try {
      if (shoes.startsWith("[")) return JSON.parse(shoes);
      return [{ name: shoes, primary: true }];
    } catch {
      return [{ name: shoes, primary: true }];
    }
  };
  return {
    id: data.id,
    fullName: data.full_name,
    nickname: data.nickname,
    avatar: data.avatar_url,
    department: data.department,
    joinedYear: data.joined_year,
    playingLevel: data.playing_level,
    dominantHand: data.dominant_hand,
    gender: data.gender,
    playingStyle: data.playing_style,
    favoriteShot: data.favorite_shot,
    favoriteIdol: data.favorite_idol,
    favoriteFormat: data.favorite_format,
    quote: data.quote,
    currentRacket: data.current_racket,
    racketDetails: data.racket_details || [],
    tournamentHistory: data.tournament_history || [],
    achievements: data.achievements || [],
    winLossRecord: (() => {
      let wins = 0,
        losses = 0;
      if (data.win_loss_record) {
        try {
          const parsed =
            typeof data.win_loss_record === "string"
              ? JSON.parse(data.win_loss_record)
              : data.win_loss_record;
          wins = parsed?.wins || 0;
          losses = parsed?.losses || 0;
        } catch {
          return data.win_loss_record;
        }
      } else if (data.stats) {
        wins = data.stats.wins || 0;
        losses = data.stats.losses || 0;
      }
      return `${wins}W - ${losses}L`;
    })(),
    nationality: data.nationality,
    homeState: data.home_state,
    height: data.height,
    yearsPlaying: data.years_playing,
    coach: data.coach,
    bio: data.bio,
    currentRanking: data.current_ranking,
    highestRanking: data.highest_ranking,
    stats: data.stats,
    recentForm: data.recent_form,
    recentMatches: data.recent_matches,
    frequentPartners: data.frequent_partners,
    careerHighlights: data.career_highlights,
    shoes:
      data.shoes && data.shoes.startsWith("[")
        ? JSON.parse(data.shoes).find((s: any) => s.primary)?.name ||
        JSON.parse(data.shoes)[0]?.name ||
        ""
        : data.shoes,
    shoesList: parseShoesList(data.shoes),
    apparel: data.apparel,
    social:
      data.instagram || data.email
        ? { instagram: data.instagram, email: data.email }
        : undefined,
    userId: data.id,
    isApproved: data.is_approved,
    role: data.role ?? 'player',
    buddies: data.buddies || [],
    buddyRequests: data.buddy_requests || [],
    elo_rating: data.elo_rating,
    singles_elo: data.singles_elo,
    doubles_elo: data.doubles_elo,
    mixed_elo: data.mixed_elo,
    singles_record: data.singles_record,
    doubles_record: data.doubles_record,
    mixed_record: data.mixed_record,
  };
}
