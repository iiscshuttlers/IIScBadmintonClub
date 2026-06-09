import re

with open("client/src/pages/Feed.tsx", "r", encoding="utf-8") as f:
    content = f.read()

injection = """
  const [feedFilter, setFeedFilter] = useState<"global" | "following">("global");
  const followingIds = useMemo(() => {
    return Array.isArray(session?.user?.following) ? session.user.following : [];
  }, [session?.user?.following]);

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

if "const displayMatches" not in content:
    content = content.replace("const courtUtil = useMemo(() => {", injection + "const courtUtil = useMemo(() => {")

with open("client/src/pages/Feed.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Feed.tsx fixed.")
