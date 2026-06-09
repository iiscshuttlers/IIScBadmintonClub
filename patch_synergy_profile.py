import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if "DoublesSynergyWidget" not in content:
    content = content.replace("Badges, ActivityHeatmap }", "Badges, ActivityHeatmap, DoublesSynergyWidget }")

# Add component
ui_injection = """
                        <Badges matches={liveMatches.filter(m => m.status === "confirmed")} playerId={id!} />
                        <DoublesSynergyWidget matches={liveMatches.filter(m => m.status === "confirmed")} playerId={id!} allPlayers={allPlayers} />
"""
content = re.sub(r"<Badges matches=\{liveMatches\.filter.*? \/>", ui_injection, content, count=1)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("DoublesSynergyWidget added to PlayerProfile.tsx")
