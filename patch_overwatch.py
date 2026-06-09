import re

with open("client/src/pages/SiteAdmin.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add suspicious flag logic
suspicious_logic = """
                    // Overwatch Tribunal Logic: Flag suspicious matches
                    const isSuspicious = useMemo(() => {
                      if (!match.player1 || !match.player2) return false;
                      const p1Elo = match.player1.elo_rating || 1200;
                      const p2Elo = match.player2.elo_rating || 1200;
                      const eloDiff = Math.abs(p1Elo - p2Elo);
                      const isUpset = (p1Elo > p2Elo + 200 && match.winner_id === match.player2_id) || 
                                      (p2Elo > p1Elo + 200 && match.winner_id === match.player1_id);
                      
                      // Check for extreme scorelines
                      let extremeScore = false;
                      if (match.match_score && Array.isArray(match.match_score)) {
                        extremeScore = match.match_score.some((set: any) => 
                          (set.p1_score >= 21 && set.p2_score <= 3) || 
                          (set.p2_score >= 21 && set.p1_score <= 3)
                        );
                      }
                      
                      return isUpset || extremeScore;
                    }, [match]);
"""

# Inject before return
content = re.sub(r"return \(\n\s*<div key=\{match\.id\}", suspicious_logic + "\n                  return (\n                    <div key={match.id}", content)

# Add UI Badge
badge_ui = """
                        {isSuspicious && (
                          <div className="flex items-center gap-1 text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                            <AlertTriangle className="w-3 h-3" /> Suspicious Result
                          </div>
                        )}
"""
content = re.sub(r"(<span className=\"flex items-center gap-1\">.*?</span>)", r"\1\n" + badge_ui, content)

with open("client/src/pages/SiteAdmin.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("SiteAdmin.tsx updated with Overwatch Tribunal.")
