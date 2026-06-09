import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
if "UserPlus" not in content:
    content = content.replace("import { Trophy, ", "import { Trophy, UserPlus, Heart, ")

# 2. State
state_injection = """
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBuddy, setIsBuddy] = useState(false);

  useEffect(() => {
    if (ownPlayerProfile && player?.userId) {
      setIsFollowing(ownPlayerProfile.following?.includes(player.userId) || false);
      setIsBuddy(ownPlayerProfile.buddies?.includes(player.userId) || false);
    }
  }, [ownPlayerProfile, player]);

  const handleToggleFollow = async () => {
    if (!player?.userId) return;
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    try {
      await supabase.rpc('toggle_follow', { p_target_id: player.userId });
      toast.success(newFollowing ? `Followed ${player.fullName}!` : `Unfollowed ${player.fullName}.`);
    } catch (e) {
      console.error(e);
      setIsFollowing(!newFollowing);
    }
  };

  const handleToggleBuddy = async () => {
    if (!player?.userId) return;
    const newBuddy = !isBuddy;
    setIsBuddy(newBuddy);
    try {
      await supabase.rpc('toggle_buddy', { p_target_id: player.userId });
      toast.success(newBuddy ? `Added ${player.fullName} as Buddy!` : `Removed ${player.fullName} from Buddies.`);
    } catch (e) {
      console.error(e);
      setIsBuddy(!newBuddy);
    }
  };
"""

content = content.replace("const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);", "const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);" + state_injection)

# 3. Buttons
button_injection = """
              {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
                <>
                  <button onClick={() => setIsLogMatchOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-black uppercase tracking-wider">
                    <Swords className="w-3.5 h-3.5" /><span className="hidden sm:inline">Log Match</span>
                  </button>
                  <button onClick={handleToggleFollow}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all text-xs font-black uppercase tracking-wider">
                    <UserPlus className="w-3.5 h-3.5" /><span className="hidden sm:inline">{isFollowing ? 'Unfollow' : 'Follow'}</span>
                  </button>
                  <button onClick={handleToggleBuddy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 hover:bg-pink-500/20 transition-all text-xs font-black uppercase tracking-wider">
                    <Heart className="w-3.5 h-3.5" /><span className="hidden sm:inline">{isBuddy ? 'Unbuddy' : 'Add Buddy'}</span>
                  </button>
                </>
              )}
"""

pattern = r"\{currentUser && player && currentUser\.id !== player\.userId && ownPlayerProfile && \(\s*<button onClick=\{\(\) => setIsLogMatchOpen\(true\)\}.*?Log Match</span>\s*</button>\s*\)\}"
content = re.sub(pattern, button_injection, content, flags=re.DOTALL)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerProfile.tsx patched successfully!")
