import re

with open("client/src/contexts/AuthContext.tsx", "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"(export interface PlayerProfile \{.*?elo_rating\?: number;.*?status\?: string;)"
replacement = r"\1\n  followers?: string[];\n  following?: string[];\n  buddies?: string[];"

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("client/src/contexts/AuthContext.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)
print("AuthContext.tsx updated")
