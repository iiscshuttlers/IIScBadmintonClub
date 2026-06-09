import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I will find the injected `totalMatches` and remove it.
# Then I will inject it properly after `const [player, setPlayer] = useState`.

bad_logic = """
  // Calibration Phase Logic
  const totalMatches = useMemo(() => {
    if (!player?.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  }, [player?.win_loss_record]);
  
  const isUnranked = totalMatches < 5;
"""

content = content.replace(bad_logic, "")

good_logic = """
  // Calibration Phase Logic
  const totalPlayedGames = useMemo(() => {
    if (!player?.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  }, [player?.win_loss_record]);
  const isUnranked = totalPlayedGames < 5;
"""

content = content.replace("const [player, setPlayer] = useState<Player | null>(null);", "const [player, setPlayer] = useState<Player | null>(null);\n" + good_logic)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerProfile.tsx fixed.")
