import re

with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix lucide-react imports
if "Sparkles" not in content.split("from \"lucide-react\"")[0]:
    content = re.sub(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"];", lambda m: "import {" + m.group(1) + ", Sparkles, ShieldCheck, Activity, Trophy} from \"lucide-react\";", content)

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Home.tsx imports fixed.")
