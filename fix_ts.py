import re

# 1. Fix PlayerProfileWidgets.tsx
with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "import { useMemo" not in content and "import React" not in content:
    content = content.replace("import { useState, useEffect } from \"react\";", "import { useState, useEffect, useMemo } from \"react\";")
elif "useMemo" not in content:
    # If useState is imported but not useMemo
    content = content.replace("useState, useEffect", "useState, useEffect, useMemo")

if "Users" not in content.split("from \"lucide-react\"")[0]:
    content = content.replace("Activity, Trophy, Swords, Sparkles, AlertTriangle, ShieldCheck, UserCheck", "Activity, Trophy, Swords, Sparkles, AlertTriangle, ShieldCheck, UserCheck, Users")

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "w", encoding="utf-8") as f:
    f.write(content)


# 2. Fix Feed.tsx
with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    feed_content = f.read()

# I need to see where displayMatches was defined.
# If I just injected it randomly, I should move it inside the Feed component.
# Let's fix it by defining displayMatches properly.
