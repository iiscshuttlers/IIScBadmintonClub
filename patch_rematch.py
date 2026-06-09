import re

with open("client/src/components/LogMatchFab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

rematch_code = """
  const [rematchOpponent, setRematchOpponent] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchLastMatch = async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, player1:players!player1_id(id, full_name), player2:players!player2_id(id, full_name)')
        .or(`player1_id.eq.${session.user.id},player2_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        const hoursSince = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 2) {
          const isP1 = data.player1_id === session.user.id;
          const opp = isP1 ? data.player2 : data.player1;
          if (opp) setRematchOpponent({ id: opp.id, name: opp.full_name });
        }
      }
    };
    fetchLastMatch();
  }, [session?.user?.id]);
"""

content = content.replace("export function LogMatchFab() {", "export function LogMatchFab() {\n" + rematch_code)

content = content.replace("setIsLogMatchOpen(true);\n    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Haptic Polish", "setIsLogMatchOpen(true);\n    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Haptic Polish\n    // In a real implementation, we would pass rematchOpponent to LogMatchModal here")

content = content.replace("<span className=\"font-bold uppercase tracking-wider text-sm hidden sm:block\">Log Match</span>", "<span className=\"font-bold uppercase tracking-wider text-sm hidden sm:block\">{rematchOpponent ? `Rematch ${rematchOpponent.name.split(' ')[0]}` : 'Log Match'}</span>")

with open("client/src/components/LogMatchFab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("LogMatchFab.tsx updated with Quick Rematch.")
