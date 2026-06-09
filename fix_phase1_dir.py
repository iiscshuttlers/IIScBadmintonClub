import re

# 1. Update PlayersDirectory.tsx
with open("client/src/pages/PlayersDirectory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("Math.abs((p.elo_rating || 1200) - (ownProfile.elo_rating || 1200)) <= 200", "Math.abs((p.elo_rating || 1200) - (ownProfile.elo_rating || 1200)) <= 150")

with open("client/src/pages/PlayersDirectory.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("PlayersDirectory updated.")
