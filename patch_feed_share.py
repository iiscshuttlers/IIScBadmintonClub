import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "import html2canvas" not in content:
    content = content.replace("import { motion } from \"framer-motion\";", "import { motion } from \"framer-motion\";\nimport html2canvas from \"html2canvas\";")

# Add ID to motion.div
content = content.replace("key={match.id}", "key={match.id}\n                    id={`match-card-${match.id}`}")

# Modify handleShare
new_share_code = """
                const handleShare = async (match: any) => {
                  const p1Name = match.player1?.full_name || 'Player 1';
                  const p2Name = match.player2?.full_name || 'Player 2';
                  const isP1Winner = match.winner_id === match.player1_id;
                  
                  // Score parsing
                  let displayScore = "N/A";
                  if (match.score) {
                    displayScore = match.score;
                  } else if (match.match_score) {
                    displayScore = match.match_score.map((set: any) => `${set.p1_score}-${set.p2_score}`).join(', ');
                  }
                  
                  const shareUrl = `${getBaseShareUrl()}/feed?match=${match.id}`;
                  const text = `?? Match Result: ${isP1Winner ? p1Name : p2Name} vs ${isP1Winner ? p2Name : p1Name} (${displayScore})! Check it out on IISc Shuttlers.`;
                  
                  try {
                    // Generate Image Recap Card
                    const el = document.getElementById(`match-card-${match.id}`);
                    if (el) {
                      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0f172a' });
                      canvas.toBlob(async (blob) => {
                        if (blob) {
                          const file = new File([blob], 'match-recap.png', { type: 'image/png' });
                          if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                              title: 'IISc Shuttlers Match',
                              text,
                              url: shareUrl,
                              files: [file]
                            });
                            toast.success("Match Recap shared!");
                            return;
                          }
                        }
                      }, 'image/png');
                    }
                    
                    // Fallback
                    if (Capacitor.isNativePlatform()) {
                      await Share.share({ title: 'IISc Shuttlers Match', text, url: shareUrl, dialogTitle: 'Share Match Result' });
                    } else if (navigator.share) {
                      await navigator.share({ title: 'IISc Shuttlers Match', text, url: shareUrl });
                    } else {
                      await navigator.clipboard.writeText(`${text}\\n${shareUrl}`);
                      toast.success("Match result copied to clipboard!");
                    }
                  } catch (err: any) {
                    if (err.message && !err.message.includes("cancel")) {
                      navigator.clipboard.writeText(`${text}\\n${shareUrl}`);
                      toast.success("Match result copied to clipboard!");
                    }
                  }
                };
"""

content = re.sub(r"const handleShare = async \(match: any\) => \{.*?\n                \};", new_share_code, content, flags=re.DOTALL)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed updated with html2canvas sharing.")
