with open("client/src/pages/PlayerProfile.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("[player?.win_loss_record]", "[(player as any)?.win_loss_record]")

with open("client/src/pages/PlayerProfile.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Dependency array fixed.")
