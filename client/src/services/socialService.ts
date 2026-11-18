import { supabase } from "@/lib/supabase";

export const socialService = {
  async toggleFollow(followerId: string, targetId: string, currentFollowing: string[], targetName: string, followerName: string) {
    const isFollowing = currentFollowing.includes(targetId);
    const newFollowingIds = isFollowing
      ? currentFollowing.filter(id => id !== targetId)
      : [...currentFollowing, targetId];

    const { error } = await supabase
      .from("players")
      .update({ following: newFollowingIds })
      .eq("id", followerId);
    
    if (error) throw error;

    if (!isFollowing) {
      void supabase.from("notifications").insert({
        user_id: targetId,
        title: "New Follower",
        message: `${followerName} started following you`,
        type: "new_follower",
        link: `/player/${followerId}`,
      }).then();

      void supabase.functions.invoke("notify-social", {
        body: {
          type: "new_follower",
          to_player_id: targetId,
          from_name: followerName,
          from_player_id: followerId,
        },
      }).then();
    }
    
    return newFollowingIds;
  },

  async notifyStatusUpdate(playerId: string, playerName: string, newStatus: string): Promise<void> {
    try {
      await supabase.functions.invoke("notify-social", {
        body: {
          type: "status_update",
          from_player_id: playerId,
          from_name: playerName,
          new_status: newStatus,
        },
      });
    } catch {
      /* intentional — best-effort social notification */
    }
  },

  async fetchPlayerEndorsements(playerId: string) {
    const { data, error } = await supabase
      .from("player_endorsements")
      .select("category, trait, endorser_id")
      .eq("endorsed_player_id", playerId);
    if (error) throw error;
    return data ?? [];
  },

  async upsertPlayerEndorsement(params: {
    endorsedPlayerId: string;
    endorserId: string;
    category: "skill" | "behavior";
    trait: string;
  }) {
    const { error } = await supabase.rpc("upsert_player_endorsement", {
      p_endorsed_player_id: params.endorsedPlayerId,
      p_endorser_id: params.endorserId,
      p_category: params.category,
      p_trait: params.trait,
    });
    if (error) throw error;
  },

  async sendPingNotification(targetId: string, senderName: string) {
    supabase.channel("global-notifications").send({
      type: "broadcast",
      event: "ping",
      payload: {
        target_id: targetId,
        sender_name: senderName || "A player",
      },
    });

    const { error } = await supabase.rpc("send_ping_notification", {
      p_target_id: targetId,
      p_sender_name: senderName || "A player",
    });
    if (error) console.warn("Failed to persist ping notification:", error.message);
  },
};

export const fetchPlayerEndorsements = socialService.fetchPlayerEndorsements;
export const upsertPlayerEndorsement = socialService.upsertPlayerEndorsement;
export const sendPingNotification = socialService.sendPingNotification;
