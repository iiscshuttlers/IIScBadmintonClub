import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Just append the new imports if they don't exist
if "Sparkles" not in content:
    content = "import { Sparkles, ShieldCheck, Activity } from 'lucide-react';\n" + content

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)
