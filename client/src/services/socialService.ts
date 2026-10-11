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
  }
};
