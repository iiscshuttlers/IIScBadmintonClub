import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the styling for mobile so they look like proper icon buttons when text is hidden
content = content.replace("className=\"flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10", 
                          "className=\"flex items-center justify-center gap-1.5 p-2.5 sm:px-4 sm:py-2 rounded-xl bg-blue-500/10")

content = content.replace("className=\"flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/10", 
                          "className=\"flex items-center justify-center gap-1.5 p-2.5 sm:px-4 sm:py-2 rounded-xl bg-violet-500/10")

content = content.replace("className=\"flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pink-500/10", 
                          "className=\"flex items-center justify-center gap-1.5 p-2.5 sm:px-4 sm:py-2 rounded-xl bg-pink-500/10")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Mobile button styles fixed.")
