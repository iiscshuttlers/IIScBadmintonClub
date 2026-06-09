import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove html2canvas import
content = content.replace("import html2canvas from \"html2canvas\";\n", "")

# Replace handleShare with native canvas implementation
native_canvas_code = """
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
                    // Generate Native Canvas Image Recap
                    const canvas = document.createElement('canvas');
                    canvas.width = 1080;
                    canvas.height = 1080;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      // Background
                      ctx.fillStyle = '#0f172a';
                      ctx.fillRect(0, 0, 1080, 1080);
                      
                      // Gradient
                      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
                      grad.addColorStop(0, '#1e293b');
                      grad.addColorStop(1, '#020617');
                      ctx.fillStyle = grad;
                      ctx.fillRect(0, 0, 1080, 1080);

                      // Text
                      ctx.fillStyle = '#10b981';
                      ctx.font = 'bold 80px sans-serif';
                      ctx.textAlign = 'center';
                      ctx.fillText('MATCH RESULT', 540, 200);

                      ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 100px sans-serif';
                      ctx.fillText(isP1Winner ? p1Name : p2Name, 540, 400);

                      ctx.fillStyle = '#94a3b8';
                      ctx.font = 'bold 60px sans-serif';
                      ctx.fillText('DEF', 540, 520);

                      ctx.fillStyle = '#ffffff';
                      ctx.font = 'bold 100px sans-serif';
                      ctx.fillText(isP1Winner ? p2Name : p1Name, 540, 660);

                      // Score
                      ctx.fillStyle = '#f59e0b';
                      ctx.font = 'bold 120px sans-serif';
                      ctx.fillText(displayScore, 540, 850);

                      ctx.fillStyle = '#334155';
                      ctx.font = 'bold 40px sans-serif';
                      ctx.fillText('IISc Shuttlers', 540, 1000);

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
                        fallbackShare();
                      }, 'image/png');
                      return;
                    }
                    
                    function fallbackShare() {
                      if (Capacitor.isNativePlatform()) {
                        Share.share({ title: 'IISc Shuttlers Match', text, url: shareUrl, dialogTitle: 'Share Match Result' });
                      } else if (navigator.share) {
                        navigator.share({ title: 'IISc Shuttlers Match', text, url: shareUrl });
                      } else {
                        navigator.clipboard.writeText(`${text}\\n${shareUrl}`);
                        toast.success("Match result copied to clipboard!");
                      }
                    }
                    
                  } catch (err: any) {
                    if (err.message && !err.message.includes("cancel")) {
                      navigator.clipboard.writeText(`${text}\\n${shareUrl}`);
                      toast.success("Match result copied to clipboard!");
                    }
                  }
                };
"""

content = re.sub(r"const handleShare = async \(match: any\) => \{.*?\n                \};", native_canvas_code, content, flags=re.DOTALL)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed updated with Native Canvas sharing.")
