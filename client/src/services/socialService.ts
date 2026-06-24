import { supabase } from "@/lib/supabase";

export const socialService = {
  async sendBuddyRequest(senderId: string, receiverId: string, senderName: string) {
    const { error } = await supabase.from("buddy_requests").insert({
      sender_id: senderId,
      receiver_id: receiverId,
    });
    if (error) throw error;

    // In-app notification
    void supabase.from("notifications").insert({
      user_id: receiverId,
      title: "New Buddy Request",
      message: `${senderName} sent you a buddy request`,
      type: "buddy_request",
      link: `/player/${senderId}`,
    }).then();

    // Push notification
    void supabase.functions.invoke("notify-social", {
      body: {
        type: "buddy_request",
        to_player_id: receiverId,
        from_name: senderName,
        from_player_id: senderId,
      },
    }).then();
  },

  async cancelBuddyRequest(senderId: string, receiverId: string) {
    const { error } = await supabase.from("buddy_requests")
      .delete()
      .eq("sender_id", senderId)
      .eq("receiver_id", receiverId);
    if (error) throw error;
  },

  async acceptBuddyRequest(senderId: string, receiverId: string, receiverName: string) {
    const { error } = await supabase.from("buddy_requests")
      .update({ status: "accepted" })
      .eq("sender_id", senderId) // The person who originally sent it
      .eq("receiver_id", receiverId); // The person accepting it
    if (error) throw error;

    await supabase.from("site_data").upsert({
      key: "latest_buddy_acceptance",
      value: {
        accepterId: receiverId,
        accepterName: receiverName,
        senderId: senderId,
        timestamp: Date.now()
      }
    });
  },

  async removeBuddy(p1: string, p2: string) {
    const { error } = await supabase.from("buddy_requests")
      .delete()
      .or(`and(sender_id.eq.${p1},receiver_id.eq.${p2}),and(sender_id.eq.${p2},receiver_id.eq.${p1})`);
    if (error) throw error;
  },

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
  }
};
