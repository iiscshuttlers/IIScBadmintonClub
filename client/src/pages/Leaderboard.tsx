import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Trophy,
  TrendingUp,
  Medal,
  ChevronLeft,
  ChevronRight,
  User,
  Swords,
  Crown,
  Flame,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { InfoModal } from "@/components/InfoModal";

interface PlayerRank {
  id: string;
  full_name: string;
  avatar_url: string;
  elo_rating: number;
  department: string;
  win_loss_record: string;
  playing_level: string;
}

interface LeaderboardProps {
  players: PlayerRank[];
}

export function LeaderboardSection({ players }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<"elo" | "ironman">("elo");

  // Parse total matches from "10W - 5L" or similar format
  const getMatchesCount = (record: string | any) => {
    if (!record) return 0;
    const formatted =
      typeof record === "string" && record.includes("W")
        ? record
        : (() => {
            try {
              const parsed =
                typeof record === "string" ? JSON.parse(record) : record;
              if (
                parsed &&
                typeof parsed.wins === "number" &&
                typeof parsed.losses === "number"
              ) {
                return `${parsed.wins}W - ${parsed.losses}L`;
              }
            } catch {}
            return String(record);
          })();

    const match = formatted.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
    if (match) return parseInt(match[1]) + parseInt(match[2]);
    return 0;
  };

  const displayRecord = (record: string | any) => {
    if (!record) return "No data";
    try {
      const parsed = typeof record === "string" ? JSON.parse(record) : record;
      if (
        parsed &&
        typeof parsed.wins === "number" &&
        typeof parsed.losses === "number"
      ) {
        return `${parsed.wins}W - ${parsed.losses}L`;
      }
    } catch {}
    return String(record);
  };

  const rankedPlayers = [...players]
    .filter(p => getMatchesCount(p.win_loss_record) >= 5)
    .sort((a, b) => {
      if (activeTab === "elo") return b.elo_rating - a.elo_rating;
      return (
        getMatchesCount(b.win_loss_record) - getMatchesCount(a.win_loss_record)
      );
    });

  const top3 = rankedPlayers.slice(0, 3);
  const rest = rankedPlayers.slice(3);

  return (
    <div className="pb-24 font-sans">
      <div className="mt-8 relative z-20">
        {/* Toggle Tabs */}
        <div className="flex justify-center mb-12">
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1 shadow-inner border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("elo")}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 ${activeTab === "elo" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <div className="flex items-center"><Crown className="w-4 h-4 mr-1.5" />ELO Rankings</div>
              <InfoModal
                title="HOW ELO RANKING WORKS"
                mainIcon={<BarChart3 className="w-5 h-5" />}
                items={[
                  { badge: "SYS", title: "The Elo System", desc: "A method used to calculate relative skill. Beating a high-ranked player grants you significantly more points than beating a low-ranked one." },
                  { badge: "CAL", title: "Calibration Phase", desc: "New players remain 'Unranked' for their first 5 matches to determine their true baseline." },
                  { badge: "VOL", title: "Volatility", desc: "Your rank fluctuates wildly in your first 20 matches. It stabilizes as you play more." },
                  { badge: "PTS", title: "Point Difference", desc: "Winning 21-5 rewards slightly more ELO than winning 21-19. Every point matters!" }
                ]}
              />
            </button>
            <button
              onClick={() => setActiveTab("ironman")}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-1.5 ${activeTab === "ironman" ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-1.5" />Ironman Endurance</div>
              <InfoModal
                title="IRONMAN ENDURANCE"
                mainIcon={<Trophy className="w-5 h-5" />}
                items={[
                  { badge: "PLAY", title: "Most Active", desc: "Ranked entirely by the total number of matches you have played, regardless of wins or losses." },
                  { badge: "IRON", title: "The Ironman Badge", desc: "Playing 50+ matches in a single month might earn you the exclusive Ironman badge!" }
                ]}
                triggerClassName={activeTab === "ironman" ? "text-orange-100 hover:text-white" : ""}
              />
            </button>
          </div>
        </div>

        {/* Podium (Top 3) */}
        {top3.length > 0 && (
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 mb-16 px-4">
            {/* 2nd Place */}
            {top3[1] && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex-1 w-full md:w-auto max-w-xs flex flex-col items-center order-2 md:order-1"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-300 dark:border-slate-600 bg-slate-800 shadow-xl overflow-hidden mb-3 relative z-10">
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
                <div className="w-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-t-2xl p-4 md:p-6 text-center border-t border-x border-white/20 shadow-2xl relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white flex items-center justify-center font-black text-sm shadow-md border-2 border-white/20">
                    2
                  </div>
                  <h3 className="font-black text-slate-800 dark:text-white text-lg line-clamp-1 mt-2">
                    {top3[1].full_name}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                      {activeTab === "elo"
                        ? `${top3[1].elo_rating} ELO`
                        : `${getMatchesCount(top3[1].win_loss_record)} Matches`}
                    </span>
                  </div>
                </div>
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
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-amber-400 bg-amber-900 shadow-[0_0_40px_rgba(251,191,36,0.3)] overflow-hidden mb-3 relative z-10">
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
                <div className="w-full bg-gradient-to-b from-amber-300 to-amber-500 dark:from-amber-600 dark:to-amber-800 rounded-t-2xl p-5 md:p-8 text-center border-t border-x border-amber-200/50 shadow-2xl relative">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black text-lg shadow-lg border-2 border-amber-200">
                    1
                  </div>
                  <Medal className="w-6 h-6 text-amber-100 absolute top-4 right-4 opacity-50" />
                  <h3 className="font-black text-amber-950 dark:text-white text-xl line-clamp-1 mt-1">
                    {top3[0].full_name}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="font-black text-amber-900 dark:text-amber-100 text-base">
                      {activeTab === "elo"
                        ? `${top3[0].elo_rating} ELO`
                        : `${getMatchesCount(top3[0].win_loss_record)} Matches`}
                    </span>
                  </div>
                </div>
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
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-orange-300 dark:border-orange-800 bg-orange-900 shadow-xl overflow-hidden mb-3 relative z-10">
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
                <div className="w-full bg-gradient-to-b from-orange-200 to-orange-300 dark:from-orange-800 dark:to-orange-900 rounded-t-2xl p-3 md:p-5 text-center border-t border-x border-white/10 shadow-2xl relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-orange-300 dark:bg-orange-700 text-orange-950 dark:text-white flex items-center justify-center font-black text-xs shadow-md border-2 border-white/20">
                    3
                  </div>
                  <h3 className="font-black text-orange-950 dark:text-white text-base line-clamp-1 mt-2">
                    {top3[2].full_name}
                  </h3>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="font-bold text-orange-800 dark:text-orange-200 text-xs">
                      {activeTab === "elo"
                        ? `${top3[2].elo_rating} ELO`
                        : `${getMatchesCount(top3[2].win_loss_record)} Matches`}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Full List */}
        <div className="max-w-4xl mx-auto">
          <Card className="rounded-3xl shadow-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400">
                    <th className="p-4 w-16 text-center">Rank</th>
                    <th className="p-4">Player</th>
                    <th className="p-4 hidden sm:table-cell">Department</th>
                    <th className="p-4 hidden md:table-cell">Record</th>
                    <th className="p-4 text-right">
                      {activeTab === "elo" ? "ELO" : "Matches Played"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {rest.map((player, index) => {
                    // Derive a visual rank-trend indicator from ELO vs baseline (1200)
                    const eloBaseline = 1200;
                    const eloGap = player.elo_rating - eloBaseline;
                    const trend =
                      activeTab !== "elo"
                        ? null
                        : eloGap > 80
                          ? "up"
                          : eloGap < -80
                            ? "down"
                            : "stable";
                    return (
                    <tr
                      key={player.id}
                      className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors group"
                    >
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-black text-slate-400 dark:text-slate-500">#{index + 4}</span>
                          {trend === "up" && (
                            <span className="text-emerald-500 text-[10px] font-black leading-none">▲</span>
                          )}
                          {trend === "down" && (
                            <span className="text-rose-500 text-[10px] font-black leading-none">▼</span>
                          )}
                          {trend === "stable" && (
                            <span className="text-slate-400 text-[10px] font-black leading-none">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Link href={`/player/${player.id}`}>
                          <div className="flex items-center gap-3 cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-transparent group-hover:border-emerald-400 transition-colors">
                              {player.avatar_url ? (
                                <img
                                  src={player.avatar_url}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-full h-full p-2 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-black text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {player.full_name}
                              </div>
                              <div className="text-xs font-bold text-slate-400 sm:hidden">
                                {player.department}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 hidden sm:table-cell text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {player.department}
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        {player.win_loss_record ? (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-bold font-mono">
                            {displayRecord(player.win_loss_record)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-xs font-bold italic">
                            No data
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                          <Swords className="w-3 h-3" />
                          <span className="font-black">
                            {activeTab === "elo"
                              ? player.elo_rating
                              : getMatchesCount(player.win_loss_record)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {rest.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold"
                      >
                        Not enough ranked players yet!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
