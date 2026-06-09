import re

with open("client/src/components/player-profile/HeadToHeadWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Generate milestone text
milestone_code = """
  // Generate Rivalry Milestone text
  const milestoneText = useMemo(() => {
    if (stats.wins === stats.losses - 1) return "You are 1 win away from tying the series!";
    if (stats.wins === stats.losses && stats.total > 0) return "The series is perfectly tied!";
    if (stats.wins === stats.losses + 1) return "They are 1 win away from tying you!";
    if (stats.isWinStreak && stats.streak >= 3) return `You are on fire! ${stats.streak}-game win streak against them.`;
    if (!stats.isWinStreak && stats.streak >= 3) return `On a ${stats.streak}-game losing streak... time for revenge?`;
    if (stats.wins > stats.losses + 3) return "You are dominating this rivalry.";
    if (stats.losses > stats.wins + 3) return "They have your number right now.";
    return null;
  }, [stats]);
"""

content = content.replace("if (stats.total === 0) return null; // No history", milestone_code + "\n  if (stats.total === 0) return null; // No history")

# Add to UI
ui_code = """
      {milestoneText && (
        <div className="mt-3 py-2 px-3 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          {milestoneText}
        </div>
      )}
"""

content = content.replace("<div className=\"mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50", ui_code + "\n      <div className=\"mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50")
content = content.replace("import { Swords, Trophy, TrendingUp, TrendingDown } from \"lucide-react\";", "import { Swords, Trophy, TrendingUp, TrendingDown, Sparkles } from \"lucide-react\";")

with open("client/src/components/player-profile/HeadToHeadWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("HeadToHeadWidget updated with Rivalry Milestones!")
