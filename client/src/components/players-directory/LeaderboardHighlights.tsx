import { motion } from "framer-motion";
import { TrendingUp, Flame } from "lucide-react";

interface Props {
  upsets: any[];
  activeStreaks: any[];
}

export function LeaderboardHighlights({ upsets, activeStreaks }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 px-4">
      {/* BIGGEST UPSETS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-rose-500" /> Biggest Upsets (Recent)
        </h3>
        <div className="space-y-3">
          {upsets.length > 0 ? upsets.map((match: any) => {
            const winner = match.winner_id === match.player1_id ? match.player1 : match.player2;
            const loser = match.winner_id === match.player1_id ? match.player2 : match.player1;
            return (
              <div key={match.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <img src={winner?.avatar_url || ""} className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-emerald-500" />
                <div className="min-w-0 flex-1 flex flex-col">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate flex items-center gap-1.5">
                    {winner?.full_name?.split(' ')[0]}
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded font-black">
                      +{match.upsetScore}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">def. {loser?.full_name?.split(' ')[0]}</div>
                </div>
              </div>
            )
          }) : (
            <div className="text-center py-4 text-slate-400 text-xs">No recent upsets found.</div>
          )}
        </div>
      </motion.div>

      {/* ACTIVE WIN STREAKS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" /> Hottest Win Streaks
        </h3>
        <div className="space-y-3">
          {activeStreaks.length > 0 ? activeStreaks.map((p: any, i: number) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-4 text-center font-black text-[10px] text-slate-400">#{i + 1}</div>
                <img src={p.avatar || ""} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                <div className="font-bold text-xs text-slate-800 dark:text-white truncate">
                  {p.name?.split(' ')[0]}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg font-black text-xs shrink-0">
                <Flame className="w-3 h-3" /> {p.streak}
              </div>
            </div>
          )) : (
            <div className="text-center py-4 text-slate-400 text-xs">No active streaks above 1.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
