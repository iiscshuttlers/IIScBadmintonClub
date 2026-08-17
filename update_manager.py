import sys
with open(r'client\src\components\admin\TournamentManager.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
old_pattern = r'  const undoTournamentMatch = async \(id: string\) => \{.*?setActingOn\(null\);\r?\n    \}\r?\n  \};'
new_str = '''  const undoTournamentMatch = async (id: string) => {
    if (!confirm("Are you sure you want to undo this tournament match? This will clear the score, reset the bracket slot, and revert ELO for all players.")) return;
    setActingOn(id);
    try {
      const { error } = await supabase.rpc("undo_tournament_match", { p_match_id: id });
      if (error) throw error;
      
      toast.success("Tournament match undone successfully");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to undo match");
    } finally {
      setActingOn(null);
    }
  };'''

if re.search(old_pattern, content, flags=re.DOTALL):
    content = re.sub(old_pattern, new_str, content, count=1, flags=re.DOTALL)
    with open(r'client\src\components\admin\TournamentManager.tsx', 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Pattern not found')
