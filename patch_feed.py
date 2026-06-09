import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add handleKudos and handleShare inside the match map loop
match_map_start = content.find("matches.map((match, i) => {")
if match_map_start == -1:
    print("Could not find matches.map")
    exit(1)

# we need to inject the functions right after `const isMatchOfTheDay = match.id === matchOfTheDayId;`
injection_point = content.find("const isMatchOfTheDay = match.id === matchOfTheDayId;", match_map_start)

if injection_point != -1:
    injection_text = """
                const handleKudos = async (match) => {
                  const storageKey = `liked_${match.id}`;
                  const isLikedDb = Array.isArray(match.kudos_users) && session?.user?.id && match.kudos_users.includes(session.user.id);
                  const isLikedLocal = !!localStorage.getItem(storageKey);
                  const isCurrentlyLiked = isLikedDb || isLikedLocal;
                  
                  if (!isCurrentlyLiked) {
                    localStorage.setItem(storageKey, "1");
                    toast.success("Kudos given! ??");
                  } else {
                    localStorage.removeItem(storageKey);
                    toast.success("Kudos removed");
                  }

                  // Force a tiny re-render or state update if possible, but React state matches will be updated on next poll
                  // Sync with live database if logged in
                  if (session?.user?.id) {
                    supabase.rpc('toggle_match_kudos', { p_match_id: match.id }).then(({error}) => { if (error) console.warn("Failed to sync kudos live:", error); });
                  }
                };

                const handleShare = async (match) => {
                  const p1Name = match.player1?.full_name || 'Player 1';
                  const p2Name = match.player2?.full_name || 'Player 2';
                  const isP1Winner = match.winner_id === match.player1_id;
                  
                  // Score parsing
                  let displayScore = "N/A";
                  if (match.score) {
                    displayScore = match.score;
                  } else if (match.match_score) {
                    displayScore = match.match_score.map(set => `${set.p1_score}-${set.p2_score}`).join(', ');
                  }
                  
                  const shareUrl = getBaseShareUrl(`/feed?match=${match.id}`);
                  const text = `?? Match Result: ${isP1Winner ? p1Name : p2Name} vs ${isP1Winner ? p2Name : p1Name} (${displayScore})! Check it out on IISc Shuttlers.`;
                  
                  try {
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
    content = content[:injection_point] + "const isMatchOfTheDay = match.id === matchOfTheDayId;\n" + injection_text + content[injection_point + len("const isMatchOfTheDay = match.id === matchOfTheDayId;"):]

# 2. Modify motion.div
motion_div_pattern = r"<motion\.div\s+initial={{ opacity: 0, y: 15 }}\s+animate={{ opacity: 1, y: 0 }}\s+transition={{ delay: i \* 0\.05 }}\s+key={match\.id}\s+className={`bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative overflow-hidden group transition-shadow.*?>"

replacement_div = """<motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={match.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative overflow-hidden group transition-shadow ${isMatchOfTheDay ? 'border-2 border-amber-400 shadow-amber-500/20 shadow-xl' : 'border border-slate-100 dark:border-slate-800 hover:shadow-md'}`}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, info) => {
                      if (info.offset.x > 100) {
                        handleKudos(match);
                      } else if (info.offset.x < -100) {
                        handleShare(match);
                      }
                    }}
                  >"""
                  
content = re.sub(motion_div_pattern, replacement_div, content, flags=re.DOTALL)

# 3. Replace Kudos button onClick
kudos_onClick_pattern = r"onClick=\{async \(e\) => \{.*?\+ 1\);.*?\}\}"
content = re.sub(kudos_onClick_pattern, "onClick={() => handleKudos(match)}", content, flags=re.DOTALL)

# 4. Replace Share button onClick
share_onClick_pattern = r"onClick=\{async \(\) => \{.*?navigator\.clipboard\.writeText\(`\$\{text\}\\n\$\{shareUrl\}`\);\n.*?toast\.success\(\"Match result copied to clipboard!\"\);\n.*?\}\n.*?\}\}"
content = re.sub(share_onClick_pattern, "onClick={() => handleShare(match)}", content, flags=re.DOTALL)

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed.tsx patched successfully!")
