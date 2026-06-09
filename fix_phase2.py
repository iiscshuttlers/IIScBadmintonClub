import re

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Giant Slayer
content = re.sub(
    r"return opponent\?\.elo_rating - myElo >= 150;\s*\}\);\s*if \(giantSlayer\) earned\.push\(\{ id: 'giant_slayer', name: 'Giant Slayer', desc: 'Beat an opponent 150\+ ELO higher', icon: '??', color: 'from-amber-400 to-orange-600' \}\);",
    r"return opponent?.elo_rating - myElo >= 200;\n      });\n      if (giantSlayer) earned.push({ id: 'giant_slayer', name: 'Giant Slayer', desc: 'Beat an opponent 200+ ELO higher', icon: '??', color: 'from-amber-400 to-orange-600' });",
    content
)

# Add Clean Sweep logic (right after Giant Slayer)
clean_sweep_code = """
      // Clean Sweep: Win where opponent score < 5
      const cleanSweep = matches.some(m => {
        if (m.winner_id !== playerId) return false;
        // Parse match_score JSON to see if any set had opponent score < 5
        if (m.match_score && Array.isArray(m.match_score)) {
          return m.match_score.some((set: any) => {
            const myScore = m.winner_id === m.player1_id ? set.p1_score : set.p2_score;
            const oppScore = m.winner_id === m.player1_id ? set.p2_score : set.p1_score;
            return myScore > oppScore && oppScore < 5;
          });
        }
        return false;
      });
      if (cleanSweep) earned.push({ id: 'clean_sweep', name: 'Clean Sweep', desc: 'Kept an opponent under 5 points', icon: '??', color: 'from-cyan-400 to-blue-600' });
"""
content = re.sub(
    r"(if \(giantSlayer\) earned\.push\(\{ id: 'giant_slayer'.*?\}\);)",
    r"\1\n" + clean_sweep_code,
    content
)

# Replace Ironman
ironman_code = """
      // Ironman: 5 consecutive days of logged matches
      const dates = [...new Set(matches.map(m => new Date(m.created_at).toDateString()))]
        .map(d => new Date(d).getTime())
        .sort((a, b) => b - a);
        
      let maxConsecutive = 1;
      let currentConsecutive = 1;
      const oneDay = 24 * 60 * 60 * 1000;
      
      for (let i = 0; i < dates.length - 1; i++) {
        if (dates[i] - dates[i+1] <= oneDay + 1000 * 60 * 60) {
          currentConsecutive++;
          if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
        } else {
          currentConsecutive = 1;
        }
      }
      
      if (maxConsecutive >= 5) earned.push({ id: 'ironman', name: 'Ironman', desc: '5 consecutive days of logged matches', icon: '??', color: 'from-rose-400 to-red-600' });
"""
content = re.sub(
    r"// Ironman: 5 matches in one day\s*const dates = matches\.map\(m => new Date\(m\.created_at\)\.toDateString\(\)\);\s*const counts = dates\.reduce.*?\s*const ironman = Object\.values\(counts\)\.some.*?\s*if \(ironman\) earned\.push\(\{ id: 'ironman'.*?\}\);",
    ironman_code,
    content,
    flags=re.DOTALL
)

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("PlayerProfileWidgets updated.")
