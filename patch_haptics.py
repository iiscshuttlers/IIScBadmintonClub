import re

with open("client/src/components/LogMatchFab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add haptic feedback
content = content.replace("setIsLogMatchOpen(true);", "setIsLogMatchOpen(true);\n    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Haptic Polish")

with open("client/src/components/LogMatchFab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("LogMatchFab.tsx updated with Haptics.")

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    feed_content = f.read()

# Add haptic to Kudos swipe
feed_content = feed_content.replace("await supabase.from('matches').update", "if (navigator.vibrate) navigator.vibrate(50);\n                          await supabase.from('matches').update")

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(feed_content)
print("Feed.tsx updated with Haptics.")
