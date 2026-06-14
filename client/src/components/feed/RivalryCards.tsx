import { useMemo } from "react";
import { Link } from "wouter";
import { Flame, Swords, Trophy } from "lucide-react";

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  winner_id: string;
  created_at: string;
  player1?: { id: string; full_name: string; avatar_url?: string };
  player2?: { id: string; full_name: string; avatar_url?: string };
}

interface Props {
  matches: Match[];
  /** Show at most N cards (default 3) */
  limit?: number;
}

interface RivalryPair {
  p1Id: string;
  p2Id: string;
  p1: { id: string; full_name: string; avatar_url?: string };
  p2: { id: string; full_name: string; avatar_url?: string };
  count: number;
  p1Wins: number;
  p2Wins: number;
  lastPlayed: string;
}

export function RivalryCards({ matches, limit = 3 }: Props) {
  const rivalries = useMemo<RivalryPair[]>(() => {
    const pairs: Record<string, RivalryPair> = {};

    for (const m of matches) {
      if (m.team1_partner_id || m.team2_partner_id) continue; // singles only for now
      const a = m.player1_id;
      const b = m.player2_id;
      if (!a || !b || !m.player1 || !m.player2) continue;

      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!pairs[key]) {
        pairs[key] = {
          p1Id: a < b ? a : b,
          p2Id: a < b ? b : a,
          p1: a < b ? m.player1 : m.player2,
          p2: a < b ? m.player2 : m.player1,
          count: 0,
          p1Wins: 0,
          p2Wins: 0,
          lastPlayed: m.created_at,
        };
      }
      pairs[key].count++;
      if (new Date(m.created_at) > new Date(pairs[key].lastPlayed)) {
        pairs[key].lastPlayed = m.created_at;
      }
      if (m.winner_id === pairs[key].p1Id) pairs[key].p1Wins++;
      else pairs[key].p2Wins++;
    }

    return Object.values(pairs)
      .filter((r) => r.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }, [matches, limit]);

  if (rivalries.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Club Rivalries</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rivalries.map((r) => {
          const leader = r.p1Wins >= r.p2Wins ? r.p1 : r.p2;
          const leaderWins = Math.max(r.p1Wins, r.p2Wins);
          const trailerWins = Math.min(r.p1Wins, r.p2Wins);
          const isClose = leaderWins - trailerWins <= 1;

          return (
            <Link key={`${r.p1Id}_${r.p2Id}`} href={`/compare/${r.p1Id}/${r.p2Id}`}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/40 transition-all cursor-pointer group relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    {r.p1.avatar_url ? (
                      <img src={r.p1.avatar_url} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                        {r.p1.full_name[0]}
                      </div>
                    )}
                    <Swords className="w-3.5 h-3.5 text-slate-400 mx-1" />
                    {r.p2.avatar_url ? (
                      <img src={r.p2.avatar_url} className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                        {r.p2.full_name[0]}
                      </div>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] font-black uppercase text-slate-400">{r.count} matches</span>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-xl font-black text-slate-800 dark:text-white">{r.p1Wins}</span>
                  <span className="text-slate-300 dark:text-slate-700 font-black">—</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white">{r.p2Wins}</span>
                </div>

                <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${r.count > 0 ? (r.p1Wins / r.count) * 100 : 50}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 truncate">
                    {isClose ? (
                      <span className="text-amber-500 font-black">EVEN RIVALRY</span>
                    ) : (
                      <span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{leader.full_name.split(" ")[0]}</span> leads
                      </span>
                    )}
                  </div>
                  {r.p1Wins === r.p2Wins && (
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
