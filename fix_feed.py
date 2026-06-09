import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Let's fix the Share button in Feed.tsx
share_button_regex = r"<button\s+onClick=\{async \(e\) => \{\s*e\.preventDefault\(\);\s*const text = [^<]+</button>"

# Actually, let's just do a string replacement for the exact onClick logic
wrong_logic = """                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        const text = `?? Match Result: ${p1.full_name} vs ${p2.full_name} (${displayScore})! Check it out on IISc Shuttlers.`;
                        const shareUrl = getBaseShareUrl() + '/feed';
                        try {
                          if (Capacitor.isNativePlatform()) {
                            await Share.share({
                              title: 'IISc Shuttlers Match',
                              text,
                              url: shareUrl,
                              dialogTitle: 'Share Match Result',
                            });
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
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                      title="Share Match"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>"""

if "?? Match Result:" in content:
    content = re.sub(r"<button[^>]*onClick=\{async \(e\) => \{[^}]*e\.preventDefault\(\);[^<]*</button>", """<button 
                      onClick={(e) => {
                        e.preventDefault();
                        handleShare(match);
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                      title="Share Match"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>""", content)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed.tsx share fixed.")
