import { Link } from "wouter";
import { motion } from "framer-motion";
import { User, Medal } from "lucide-react";
import { getEloTier } from "@/lib/tiers";
import { PlayerRank } from "@/hooks/useLeaderboardState";

interface Props {
  top3: PlayerRank[];
  activeTab: "elo" | "ironman";
  eloMode: "club" | "tournament";
  ironmanFilter: "all" | "monthly";
  monthlyCounts: Record<string, number>;
  getCategoryElo: (player: PlayerRank) => number;
  getCategoryRecord: (player: PlayerRank) => string;
  getMatchesCount: (record: string | any) => number;
  displayRecord: (record: string | any) => string;
  lastEloChange: Record<string, number>;
}

export function LeaderboardPodium({
  top3, activeTab, eloMode, ironmanFilter, monthlyCounts,
  getCategoryElo, getCategoryRecord, getMatchesCount, displayRecord,
  lastEloChange
}: Props) {
  const eloLabel = eloMode === "tournament" ? "T-ELO" : "ELO";
  if (top3.length === 0) return null;

  return (
    <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 mb-16 px-4">
      {/* 2nd Place */}
      {top3[1] && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex-1 w-full md:w-auto max-w-xs flex flex-col items-center order-2 md:order-1"
        >
          <Link href={`/player/${top3[1].id}`} className="flex flex-col items-center w-full group">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-300 dark:border-slate-600 bg-slate-800 shadow-xl overflow-hidden mb-3 relative z-10 transition-transform group-hover:scale-105">
              {top3[1].avatar_url ? (
                <img
                  src={top3[1].avatar_url}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-4 text-slate-500" />
              )}
            </div>
            <div className="w-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-t-2xl p-4 md:p-6 text-center border-t border-x border-white/20 shadow-2xl relative transition-colors group-hover:from-slate-300 group-hover:to-slate-400 dark:group-hover:from-slate-600 dark:group-hover:to-slate-700">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white flex items-center justify-center font-black text-sm shadow-md border-2 border-white/20">
                2
              </div>
              <h3 className="font-black text-slate-800 dark:text-white text-lg line-clamp-1 mt-2">
                {top3[1].full_name}
              </h3>
              <div className="flex flex-col items-center justify-center gap-0.5 mt-2">
                <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                  {activeTab === "elo"
                    ? `${getEloTier(getCategoryElo(top3[1])).name} • ${getCategoryElo(top3[1])} ${eloLabel}`
                    : ironmanFilter === "monthly" 
                      ? `${monthlyCounts[top3[1].id] || 0} Matches This Month`
                      : `${getMatchesCount(getCategoryRecord(top3[1]))} Matches All-Time`}
                </span>
                {activeTab === "elo" && lastEloChange[top3[1].id] != null && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    lastEloChange[top3[1].id] >= 0
                      ? "bg-primary/15 text-primary"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {lastEloChange[top3[1].id] >= 0 ? "+" : ""}{lastEloChange[top3[1].id]}
                  </span>
                )}
                {activeTab === "elo" && (
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                    {displayRecord(getCategoryRecord(top3[1]))}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* 1st Place */}
      {top3[0] && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 w-full md:w-auto max-w-xs flex flex-col items-center order-1 md:order-2 z-10 -mb-4 md:mb-0"
        >
          <Link href={`/player/${top3[0].id}`} className="flex flex-col items-center w-full group">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-amber-400 bg-amber-900 shadow-[0_0_40px_rgba(251,191,36,0.3)] overflow-hidden mb-3 relative z-10 transition-transform group-hover:scale-105">
              {top3[0].avatar_url ? (
                <img
                  src={top3[0].avatar_url}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-5 text-amber-500" />
              )}
            </div>
            <div className="w-full bg-gradient-to-b from-amber-300 to-amber-500 dark:from-amber-600 dark:to-amber-800 rounded-t-2xl p-5 md:p-8 text-center border-t border-x border-amber-200/50 shadow-2xl relative transition-colors group-hover:from-amber-400 group-hover:to-amber-500 dark:group-hover:from-amber-500 dark:group-hover:to-amber-700">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black text-lg shadow-lg border-2 border-amber-200">
                1
              </div>
              <Medal className="w-6 h-6 text-amber-100 absolute top-4 right-4 opacity-50" />
              <h3 className="font-black text-amber-950 dark:text-white text-xl line-clamp-1 mt-1">
                {top3[0].full_name}
              </h3>
              <div className="flex flex-col items-center justify-center gap-0.5 mt-2">
                <span className="font-black text-amber-900 dark:text-amber-100 text-base">
                  {activeTab === "elo"
                    ? `${getEloTier(getCategoryElo(top3[0])).name} • ${getCategoryElo(top3[0])} ${eloLabel}`
                    : `${getMatchesCount(getCategoryRecord(top3[0]))} Matches`}
                </span>
                {activeTab === "elo" && lastEloChange[top3[0].id] != null && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    lastEloChange[top3[0].id] >= 0
                      ? "bg-primary/20/80 text-primary"
                      : "bg-rose-200/80 text-rose-800"
                  }`}>
                    {lastEloChange[top3[0].id] >= 0 ? "+" : ""}{lastEloChange[top3[0].id]}
                  </span>
                )}
                {activeTab === "elo" && (
                  <span className="text-sm font-mono font-bold text-amber-800/80 dark:text-amber-200/80">
                    {displayRecord(getCategoryRecord(top3[0]))}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* 3rd Place */}
      {top3[2] && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex-1 w-full md:w-auto max-w-xs flex flex-col items-center order-3"
        >
          <Link href={`/player/${top3[2].id}`} className="flex flex-col items-center w-full group">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-orange-300 dark:border-orange-800 bg-orange-900 shadow-xl overflow-hidden mb-3 relative z-10 transition-transform group-hover:scale-105">
              {top3[2].avatar_url ? (
                <img
                  src={top3[2].avatar_url}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-3 text-orange-500" />
              )}
            </div>
            <div className="w-full bg-gradient-to-b from-orange-200 to-orange-300 dark:from-orange-800 dark:to-orange-900 rounded-t-2xl p-3 md:p-5 text-center border-t border-x border-white/10 shadow-2xl relative transition-colors group-hover:from-orange-300 group-hover:to-orange-400 dark:group-hover:from-orange-700 dark:group-hover:to-orange-800">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-orange-300 dark:bg-orange-700 text-orange-950 dark:text-white flex items-center justify-center font-black text-xs shadow-md border-2 border-white/20">
                3
              </div>
              <h3 className="font-black text-orange-950 dark:text-white text-base line-clamp-1 mt-2">
                {top3[2].full_name}
              </h3>
              <div className="flex flex-col items-center justify-center gap-0.5 mt-1">
                <span className="font-bold text-amber-900 dark:text-orange-200 text-sm">
                  {activeTab === "elo"
                    ? `${getEloTier(getCategoryElo(top3[2])).name} • ${getCategoryElo(top3[2])} ${eloLabel}`
                    : `${getMatchesCount(getCategoryRecord(top3[2]))} Matches`}
                </span>
                {activeTab === "elo" && lastEloChange[top3[2].id] != null && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    lastEloChange[top3[2].id] >= 0
                      ? "bg-primary/15 text-primary"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {lastEloChange[top3[2].id] >= 0 ? "+" : ""}{lastEloChange[top3[2].id]}
                  </span>
                )}
                {activeTab === "elo" && (
                  <span className="text-[10px] font-mono font-bold text-orange-700/80 dark:text-orange-300/80">
                    {displayRecord(getCategoryRecord(top3[2]))}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
