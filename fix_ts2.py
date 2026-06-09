import re

# 1. Fix PlayerProfileWidgets.tsx
with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add useMemo to react imports
content = re.sub(r"import\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['\"]react['\"];", "import { useState, useEffect, useMemo } from \"react\";", content)

# Add Users to lucide-react imports
if " Users " not in content and ", Users" not in content and "Users," not in content:
    content = re.sub(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"];", lambda m: "import {" + m.group(1) + ", Users} from \"lucide-react\";", content)

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "w", encoding="utf-8") as f:
    f.write(content)

# 2. Fix Feed.tsx User type error
with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("session?.user?.following", "(session?.user as any)?.following")
content = content.replace("session.user.following", "(session.user as any).following")

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Files fixed again.")
