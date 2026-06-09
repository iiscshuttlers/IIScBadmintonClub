import re

# 1. Fix Feed.tsx
with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("getBaseShareUrl(`/feed?match=${match.id}`)", "`${getBaseShareUrl()}/feed?match=${match.id}`")

# Also add : any to the handleKudos and handleShare
content = content.replace("const handleKudos = async (match) =>", "const handleKudos = async (match: any) =>")
content = content.replace("const handleShare = async (match) =>", "const handleShare = async (match: any) =>")

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)

# 2. Fix PlayerProfile.tsx
with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "import { Trophy, UserPlus, Heart" not in content:
    # Just to be safe, find Lucide imports and append
    lucide_pattern = r"import \{([^}]+)\} from \"lucide-react\";"
    
    def add_imports(m):
        imports = m.group(1)
        if "UserPlus" not in imports:
            imports += ", UserPlus"
        if "Heart" not in imports:
            imports += ", Heart"
        return f"import {{{imports}}} from \"lucide-react\";"
        
    content = re.sub(lucide_pattern, add_imports, content)

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed errors!")
