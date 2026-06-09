import re

# 1. Update PlayerProfile.tsx
with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

unranked_logic = """
  // Calibration Phase Logic
  const totalMatches = useMemo(() => {
    if (!player?.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  }, [player?.win_loss_record]);
  
  const isUnranked = totalMatches < 5;
"""

content = content.replace("const isOwnProfile = currentUser?.id === player?.userId;", "const isOwnProfile = currentUser?.id === player?.userId;\n" + unranked_logic)

content = content.replace("{player.elo_rating}", "{isUnranked ? 'Unranked' : player.elo_rating}")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)

# 2. Update PlayersDirectory.tsx
with open("client/src/pages/PlayersDirectory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We need to update PlayerCard component which is in a different file or inline?
# Wait, PlayerCard is imported from `client/src/components/players-directory/PlayerCard.tsx`
