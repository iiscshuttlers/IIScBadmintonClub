import re

with open("client/src/pages/PlayersDirectory.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("ownProfile.buddies?.includes(p.id)", "(ownProfile as any).buddies?.includes(p.id)")

with open("client/src/pages/PlayersDirectory.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("PlayersDirectory.tsx fixed.")
