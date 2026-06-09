import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix isUnranked logic
# I will find "const [player, setPlayer] = useState<Player | null>(null);" and insert isUnranked before it
calibration_logic = """
  // Calibration Phase Logic
  const totalMatches = useMemo(() => {
    if (!player?.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  }, [player?.win_loss_record]);
  
  const isUnranked = totalMatches < 5;
"""

if "const isUnranked = totalMatches < 5;" not in content:
    content = content.replace("const [player, setPlayer] = useState<Player | null>(null);", calibration_logic + "\n  const [player, setPlayer] = useState<Player | null>(null);")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("isUnranked added to PlayerProfile.tsx")
