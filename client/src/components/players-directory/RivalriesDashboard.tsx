import { useMemo } from "react";
import { useAllMatches, usePlayers } from "@/hooks/usePlayers";
import { Flame, Swords, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export function RivalriesDashboard() {
  const { data: matches } = useAllMatches();
  const { data: players } = usePlayers();

  const rivalries = useMemo(() => {
    if (!matches || !players) return [];

    const pairs: Record<string, { p1: string; p2: string; m1Wins: number; m2Wins: number; total: number }> = {};

    matches.forEach(m => {
      // Only singles matches
      if (m.team1_partner_id || m.team2_partner_id) return;

      const p1 = m.player1_id;
      const p2 = m.player2_id;
      if (!p1 || !p2) return;

      const [a, b] = p1 < p2 ? [p1, p2] : [p2, p1];
      const key = `${a}-${b}`;

      if (!pairs[key]) {
        pairs[key] = { p1: a, p2: b, m1Wins: 0, m2Wins: 0, total: 0 };
      }

      pairs[key].total += 1;
      if (m.winner_id === a) pairs[key].m1Wins += 1;
      else if (m.winner_id === b) pairs[key].m2Wins += 1;
    });

    const results = Object.values(pairs)
      .filter(r => r.total >= 5) // At least 5 matches
      .map(r => {
        const p1Name = players.find(p => p.id === r.p1)?.full_name || "Unknown";
        const p2Name = players.find(p => p.id === r.p2)?.full_name || "Unknown";
        const p1Avatar = players.find(p => p.id === r.p1)?.avatar_url || "";
        const p2Avatar = players.find(p => p.id === r.p2)?.avatar_url || "";
        const p1WinPct = (r.m1Wins / r.total) * 100;
        const closeness = Math.abs(p1WinPct - 50); // Lower is closer to 50/50
        
        return { ...r, p1Name, p2Name, p1Avatar, p2Avatar, p1WinPct, closeness };
      })
      .sort((a, b) => a.closeness - b.closeness) // Sort by most closely contested
      .slice(0, 6);

    return results;
  }, [matches, players]);

  if (!rivalries || rivalries.length === 0) return null;

  return (
    <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-800">
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">Top Rivalries</h2>
            <p className="text-sm font-medium text-slate-400">The most hotly contested matchups in the club (Min. 5 matches)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rivalries.map((r, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800 transition-colors group">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">
                  {r.total} Matches
                </span>
                {r.closeness <= 10 && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Neck & Neck
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Link href={`/player/${r.p1}`} className="flex flex-col items-center gap-2 group-hover:scale-105 transition-transform flex-1">
                  <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden ring-2 ring-slate-600 group-hover:ring-orange-500 transition-colors">
                    {r.p1Avatar ? (
                      <img src={r.p1Avatar} alt={r.p1Name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-400">{r.p1Name[0]}</div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white text-center line-clamp-1">{r.p1Name.split(" ")[0]}</span>
                  <span className="text-xl font-black text-emerald-400">{r.m1Wins}</span>
                </Link>

                <div className="text-slate-600">
                  <Swords className="w-6 h-6" />
                </div>

                <Link href={`/player/${r.p2}`} className="flex flex-col items-center gap-2 group-hover:scale-105 transition-transform flex-1">
                  <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden ring-2 ring-slate-600 group-hover:ring-orange-500 transition-colors">
                    {r.p2Avatar ? (
                      <img src={r.p2Avatar} alt={r.p2Name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-400">{r.p2Name[0]}</div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white text-center line-clamp-1">{r.p2Name.split(" ")[0]}</span>
                  <span className="text-xl font-black text-emerald-400">{r.m2Wins}</span>
                </Link>
              </div>

              <div className="mt-5 h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${r.p1WinPct}%` }} />
                <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${100 - r.p1WinPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
