import re

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "r", encoding="utf-8") as f:
    content = f.read()

widget_code = """
export const DoublesSynergyWidget = ({ matches, playerId, allPlayers }: { matches: any[], playerId: string, allPlayers: any[] }) => {
  const synergy = useMemo(() => {
    const stats: Record<string, { wins: number; total: number; name: string }> = {};

    matches.forEach(m => {
      // Determine if I played doubles and who my partner was
      let partnerId = null;
      let myTeamWon = false;

      if (m.player1_id === playerId && m.team1_partner_id) {
        partnerId = m.team1_partner_id;
        myTeamWon = m.match_winner_id === m.player1_id;
      } else if (m.team1_partner_id === playerId) {
        partnerId = m.player1_id;
        myTeamWon = m.match_winner_id === m.player1_id;
      } else if (m.player2_id === playerId && m.team2_partner_id) {
        partnerId = m.team2_partner_id;
        myTeamWon = m.match_winner_id === m.player2_id;
      } else if (m.team2_partner_id === playerId) {
        partnerId = m.player2_id;
        myTeamWon = m.match_winner_id === m.player2_id;
      }

      if (partnerId) {
        if (!stats[partnerId]) {
          const pName = allPlayers?.find(p => p.id === partnerId)?.full_name || "Unknown Partner";
          stats[partnerId] = { wins: 0, total: 0, name: pName };
        }
        stats[partnerId].total++;
        if (myTeamWon) stats[partnerId].wins++;
      }
    });

    const arr = Object.entries(stats).map(([id, s]) => ({ id, ...s, winPct: s.wins / s.total }));
    return arr.sort((a, b) => b.winPct - a.winPct || b.total - a.total).filter(x => x.total > 0);
  }, [matches, playerId, allPlayers]);

  if (synergy.length === 0) return null;

  const bestPartner = synergy[0];

  return (
    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-3xl p-5 border border-teal-100 dark:border-teal-800/50 shadow-sm relative overflow-hidden mt-6">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Users className="w-24 h-24 text-teal-500" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-lg">
          <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-teal-900 dark:text-teal-300">Best Doubles Partner</h3>
      </div>

      <div className="relative z-10">
        <div className="text-xl font-black text-teal-700 dark:text-teal-300 mb-1">{bestPartner.name}</div>
        <div className="flex items-end gap-2">
          <div className="text-3xl font-black text-teal-600 dark:text-teal-400">
            {Math.round(bestPartner.winPct * 100)}% <span className="text-sm uppercase tracking-widest text-teal-500/70">Win Rate</span>
          </div>
        </div>
        <div className="text-xs font-bold text-teal-600/70 dark:text-teal-400/70 mt-2">
          {bestPartner.wins} Wins in {bestPartner.total} Matches together
        </div>
      </div>
    </div>
  );
};
"""

content = content + "\n\n" + widget_code
content = content.replace("import { Activity, Trophy, Swords, Sparkles, AlertTriangle, ShieldCheck, UserCheck } from \"lucide-react\";", "import { Activity, Trophy, Swords, Sparkles, AlertTriangle, ShieldCheck, UserCheck, Users } from \"lucide-react\";")

with open("client/src/components/player-profile/PlayerProfileWidgets.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("DoublesSynergyWidget added.")
