import re

with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("<Swords className=\"w-3.5 h-3.5\" />", "<Swords className=\"w-5 h-5\" />")
content = content.replace("<UserPlus className=\"w-3.5 h-3.5\" />", "<UserPlus className=\"w-5 h-5\" />")
content = content.replace("<Heart className=\"w-3.5 h-3.5\" />", "<Heart className=\"w-5 h-5\" />")
content = content.replace("<Trash2 className=\"w-4 h-4\" />", "<Trash2 className=\"w-5 h-5\" />")
content = content.replace("<Share2 className=\"w-4 h-4\" />", "<Share2 className=\"w-5 h-5\" />")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Icons size increased.")
