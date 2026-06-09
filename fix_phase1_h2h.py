import re

with open("client/src/components/player-profile/HeadToHeadWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add pointDiff variable
content = content.replace("let isWinStreak = true;", "let isWinStreak = true;\n    let pointDiff = 0;")

# Calculate pointDiff in the loop
calc_point_diff = """
      // Calculate Point Differential
      if (m.match_score && Array.isArray(m.match_score)) {
        const isMyTeam1 = m.player1_id === currentUserId || m.team1_partner_id === currentUserId;
        m.match_score.forEach((set: any) => {
          if (isMyTeam1) {
            pointDiff += (set.p1_score || 0) - (set.p2_score || 0);
          } else {
            pointDiff += (set.p2_score || 0) - (set.p1_score || 0);
          }
        });
      }
"""

content = content.replace("if (myTeamWon) wins++;\n      else losses++;", "if (myTeamWon) wins++;\n      else losses++;\n" + calc_point_diff)

# Add pointDiff to returned stats
content = content.replace("return { wins, losses, streak, isWinStreak, total: wins + losses };", "return { wins, losses, streak, isWinStreak, total: wins + losses, pointDiff };")

# Add Point Differential to the UI
ui_addition = """
      <div className="grid grid-cols-2 gap-4 relative z-10 mt-4">
        <div>
          <div className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase mb-1">Point Differential</div>
          <div className={`text-2xl font-black flex items-end gap-1 ${stats.pointDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : stats.pointDiff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
          </div>
        </div>
      </div>
"""

content = content.replace("</div>\n\n      <div className=\"mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50", "</div>\n" + ui_addition + "\n      <div className=\"mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50")

with open("client/src/components/player-profile/HeadToHeadWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("HeadToHeadWidget updated.")
