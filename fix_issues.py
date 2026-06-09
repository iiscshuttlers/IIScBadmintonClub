import re

with open("client/src/components/players-directory/PlayerCard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "import { motion } from \"framer-motion\";" not in content:
    content = content.replace("import { Card", "import { motion } from \"framer-motion\";\nimport { Card")

with open("client/src/components/players-directory/PlayerCard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# There might be an existing handleShare in Feed.tsx
# In Feed.tsx: const handleShare = async () => { ... }
# I need to see what's wrong around line 284 in Feed.tsx
