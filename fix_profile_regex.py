import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"const handleToggleFollow = async \(\) => \{[\s\S]*?catch \(e\) \{\s*console\.error\(e\);\s*setIsBuddy\(!newBuddy\);\s*\}\s*\};"

replacement = """const handleToggleFollow = async () => {
    if (!player?.userId || !currentUser?.id) return;
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    try {
      const { data: myProfile } = await supabase.from('players').select('following').eq('user_id', currentUser.id).single();
      let currentFollowing = myProfile?.following || [];
      if (newFollowing && !currentFollowing.includes(player.userId)) {
        currentFollowing.push(player.userId);
      } else if (!newFollowing) {
        currentFollowing = currentFollowing.filter((id: string) => id !== player.userId);
      }
      await supabase.from('players').update({ following: currentFollowing }).eq('user_id', currentUser.id);
      toast.success(newFollowing ? `Followed ${player.fullName}!` : `Unfollowed ${player.fullName}.`);
    } catch (e) {
      console.error(e);
      setIsFollowing(!newFollowing);
      try {
         await supabase.rpc('toggle_follow', { p_target_id: player.userId });
         setIsFollowing(newFollowing);
      } catch(err) {
         console.error("RPC fallback failed too", err);
      }
    }
  };

  const handleToggleBuddy = async () => {
    if (!player?.userId || !currentUser?.id) return;
    const newBuddy = !isBuddy;
    setIsBuddy(newBuddy);
    try {
      const { data: myProfile } = await supabase.from('players').select('buddies').eq('user_id', currentUser.id).single();
      let currentBuddies = myProfile?.buddies || [];
      if (newBuddy && !currentBuddies.includes(player.userId)) {
        currentBuddies.push(player.userId);
      } else if (!newBuddy) {
        currentBuddies = currentBuddies.filter((id: string) => id !== player.userId);
      }
      await supabase.from('players').update({ buddies: currentBuddies }).eq('user_id', currentUser.id);
      toast.success(newBuddy ? `Added ${player.fullName} as Buddy!` : `Removed ${player.fullName} from Buddies.`);
    } catch (e) {
      console.error(e);
      setIsBuddy(!newBuddy);
      try {
         await supabase.rpc('toggle_buddy', { p_target_id: player.userId });
         setIsBuddy(newBuddy);
      } catch(err) {
         console.error("RPC fallback failed too", err);
      }
    }
  };"""

content = re.sub(pattern, replacement, content, count=1)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerProfile.tsx fixed.")
