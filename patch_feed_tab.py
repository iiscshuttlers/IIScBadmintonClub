import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add feedFilter state
state_injection = """
  const [feedFilter, setFeedFilter] = useState<"global" | "following">("global");
  const followingIds = useMemo(() => {
    return Array.isArray(session?.user?.following) ? session.user.following : [];
  }, [session?.user?.following]);
"""

content = content.replace("const [limitCount, setLimitCount] = useState(15);", state_injection + "\n  const [limitCount, setLimitCount] = useState(15);")

# Update matches filter
matches_filter_injection = """
  // Filter matches based on feedFilter
  const displayMatches = useMemo(() => {
    if (feedFilter === "global") return matches;
    return matches.filter((m: any) => 
      followingIds.includes(m.player1_id) || 
      followingIds.includes(m.player2_id) || 
      (m.team1_partner_id && followingIds.includes(m.team1_partner_id)) || 
      (m.team2_partner_id && followingIds.includes(m.team2_partner_id))
    );
  }, [matches, feedFilter, followingIds]);
"""

content = content.replace("const { matches, weeklyRecap, courtUtil, loading, matchOfTheDayId } = useFeed(limitCount);", "const { matches, weeklyRecap, courtUtil, loading, matchOfTheDayId } = useFeed(limitCount);\n" + matches_filter_injection)

# Filter usage
content = content.replace("matches.length > 0", "displayMatches.length > 0")
content = content.replace("matches.map((match, i) =>", "displayMatches.map((match: any, i: number) =>")
content = content.replace("matches.length >=", "displayMatches.length >=")

# UI Toggle
toggle_ui = """
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              Live Activity
            </h2>
            {session && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  onClick={() => setFeedFilter("global")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${feedFilter === 'global' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  Global
                </button>
                <button 
                  onClick={() => setFeedFilter("following")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${feedFilter === 'following' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  Following
                </button>
              </div>
            )}
          </div>
"""

content = content.replace("""<h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
            <Activity className="w-6 h-6 text-emerald-500" />
            Live Activity
          </h2>""", toggle_ui)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Feed updated with Following tab.")
