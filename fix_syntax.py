import re

# 1. Fix PlayerCard.tsx
with open("client/src/components/players-directory/PlayerCard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove the broken placement
broken_code = """export function PlayerCard({

  // Calibration Phase
  const totalMatches = (() => {
    if (!player.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  })();
  const isUnranked = totalMatches < 5;
 player, isOwn = false, isAdmin = false, onDelete, onEdit, onLogMatch }: PlayerCardProps) {"""

fixed_code = """export function PlayerCard({ player, isOwn = false, isAdmin = false, onDelete, onEdit, onLogMatch }: PlayerCardProps) {
  // Calibration Phase
  const totalMatches = (() => {
    if (!player.win_loss_record) return 0;
    const [w, l] = player.win_loss_record.split('-').map(Number);
    return (w || 0) + (l || 0);
  })();
  const isUnranked = totalMatches < 5;"""

content = content.replace(broken_code, fixed_code)

with open("client/src/components/players-directory/PlayerCard.tsx", "w", encoding="utf-8") as f:
    f.write(content)


# 2. Fix Home.tsx
with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I need to see how the opening div looks.
