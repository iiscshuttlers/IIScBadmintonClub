import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "Sparkles" not in content.split("from 'lucide-react'")[0] and "import { Sparkles" not in content:
    content = "import { Sparkles, ShieldCheck, Activity } from 'lucide-react';\n" + content

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    p_content = f.read()

p_content = p_content.replace("!player?.win_loss_record", "!(player as any)?.win_loss_record")
p_content = p_content.replace("player.win_loss_record.split", "(player as any).win_loss_record.split")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(p_content)

print("Imports and Types fixed.")
