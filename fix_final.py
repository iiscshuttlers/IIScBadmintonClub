import re

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("import { useEffect, useState } from \"react\";", "import { useEffect, useState, useMemo } from \"react\";")
content = "import { Users } from \"lucide-react\";\n" + content

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Added useMemo and Users")
