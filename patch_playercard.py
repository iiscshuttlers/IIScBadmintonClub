import re

with open("client/src/components/players-directory/PlayerCard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

calibration_code = """
  // Calibration Phase
  const totalMatches = (() => {
    if (!player.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  })();
  const isUnranked = totalMatches < 5;
"""

content = content.replace("export function PlayerCard({", "export function PlayerCard({")
content = re.sub(r"(export function PlayerCard.*?\{)", r"\1\n" + calibration_code, content, count=1)

content = content.replace("{player.elo_rating}", "{isUnranked ? '?' : player.elo_rating}")
content = content.replace("{player.elo_rating || 1200}", "{isUnranked ? '?' : (player.elo_rating || 1200)}")

with open("client/src/components/players-directory/PlayerCard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayerCard.tsx updated.")
