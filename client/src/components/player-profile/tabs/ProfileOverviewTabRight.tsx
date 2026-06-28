import { motion } from "framer-motion";
import { Quote, Trophy, Calendar, BookOpen, Medal, Swords } from "lucide-react";
import type { PlayerProfileType } from "@/types";
import { PlayerEndorsementsWidget } from "../PlayerEndorsementsWidget";
import type { TournamentRun } from "@/hooks/useTournamentMatchHistory";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ProfileOverviewTabRight({
  player,
  validAchievements,
  splitStats,
  tournamentRuns,
}: {
  player: PlayerProfileType;
  validAchievements: string[];
  splitStats?: any;
  tournamentRuns?: TournamentRun[];
}) {
  const dynamicWins = splitStats?.all?.wins ?? 0;
  const dynamicLosses = splitStats?.all?.losses ?? 0;
  const displayRecord = (dynamicWins > 0 || dynamicLosses > 0)
    ? `${dynamicWins}W - ${dynamicLosses}L`
    : player.winLossRecord || "0W - 0L";
  return (
    <>
      {/* Quote */}
      {player.quote && (
        <motion.div variants={itemVariants} className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-800 to-amber-500 rounded-[1.75rem] blur opacity-25 group-hover:opacity-50 transition duration-500" />
          <div className="relative bg-gradient-to-br from-[#1a3a7a] via-[#0f2347] to-[#070d1a] rounded-[1.75rem] p-7 shadow-lg shadow-blue-950/40 overflow-hidden border border-amber-500/20">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-400/0 via-amber-400/50 to-amber-400/0" />
            <Quote className="absolute -bottom-3 -right-3 w-24 h-24 text-amber-400/[0.12] -rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-base sm:text-lg font-serif italic text-white/85 leading-snug">
                "{player.quote}"
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bio */}
      {player.bio && (
        <motion.section
          variants={itemVariants}
          className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-cyan-500" />
          <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />{" "}
            About
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-white/65">
            {player.bio}
          </p>
          {(player.coach ||
            player.yearsPlaying != null ||
            player.highestRanking != null) && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/8 space-y-2.5">
              {player.coach && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 dark:text-white/35 font-medium">
                    Coach
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white/90">
                    {player.coach}
                  </span>
                </div>
              )}
              {player.yearsPlaying != null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 dark:text-white/35 font-medium">
                    Years Playing
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white/90">
                    {player.yearsPlaying} yrs
                  </span>
                </div>
              )}
              {player.highestRanking != null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 dark:text-white/35 font-medium">
                    Career-High Rank
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white/90">
                    #{player.highestRanking}
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.section>
      )}

      {/* Career Record + Achievements */}
      <motion.section
        variants={itemVariants}
        className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500" />
        <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-500" /> Career Record
        </h2>

        {/* W/L block */}
        <div className="mb-6 p-5 bg-black/40 rounded-xl relative overflow-hidden border border-slate-300 dark:border-white/6">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.08] to-transparent" />
          <div className="relative z-10">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2">
              Overall W/L
            </div>
            <div className="text-2xl font-black text-white">
              {displayRecord}
            </div>
          </div>
        </div>

        {/* Bracket Record */}
        {tournamentRuns && tournamentRuns.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-white/35 mb-3 flex items-center gap-1.5">
              <Swords className="w-3 h-3 text-emerald-500" /> Bracket Record
            </h3>
            <div className="space-y-2">
              {tournamentRuns.map((run) => {
                const total = run.wins + run.losses;
                const winPct = total > 0 ? Math.round((run.wins / total) * 100) : 0;
                const resultLabel = run.eliminated
                  ? `Out in ${run.deepest_round_name}`
                  : `${run.deepest_round_name} ✓`;
                return (
                  <div
                    key={`${run.tournament_id}_${run.category}`}
                    className="rounded-xl border border-slate-200 dark:border-white/6 bg-slate-50 dark:bg-white/[0.03] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-white/85 truncate leading-tight">
                          {run.tournament_name}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-white/35 uppercase tracking-wider">
                          {run.category}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold shrink-0 px-2 py-0.5 rounded-full ${run.eliminated ? "bg-slate-200 dark:bg-white/8 text-slate-500 dark:text-white/40" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>
                        {resultLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${winPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 dark:text-white/35 shrink-0">
                        {run.wins}W – {run.losses}L
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Achievements */}
        {validAchievements.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-white/35 mb-4 flex items-center gap-1.5">
              <Medal className="w-3 h-3 text-amber-500 dark:text-amber-400" />{" "}
              Achievements
            </h3>
            <div className="relative ml-5 space-y-3">
              <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-500/60 rounded-full" />
              {[...validAchievements]
                .sort((a, b) => {
                  const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  return yearA !== yearB ? yearB - yearA : a.localeCompare(b);
                })
                .map((ach, idx) => {
                  const lower = ach.toLowerCase();
                  const isGold =
                    lower.includes("winner") ||
                    lower.includes("champion") ||
                    lower.includes("1st") ||
                    lower.includes("gold");
                  const isSilver =
                    lower.includes("runner-up") ||
                    lower.includes("2nd") ||
                    lower.includes("silver");
                  const isBronze =
                    lower.includes("semifinalist") ||
                    lower.includes("bronze") ||
                    lower.includes("3rd");
                  const icon = isGold
                    ? "🥇"
                    : isSilver
                    ? "🥈"
                    : isBronze
                    ? "🥉"
                    : "⭐";
                  const bg = isGold
                    ? "bg-amber-500/10 ring-amber-500/25"
                    : isSilver
                    ? "bg-slate-200 dark:bg-white/8 ring-white/20"
                    : isBronze
                    ? "bg-orange-500/10 ring-orange-500/25"
                    : "bg-emerald-500/10 ring-emerald-500/25";
                  return (
                    <div key={idx} className="relative flex gap-3 items-start">
                      <div
                        className={`relative -ml-[18px] mt-0.5 shrink-0 w-8 h-8 rounded-full ${bg} ring-2 flex items-center justify-center shadow-sm`}
                      >
                        <span className="text-xs">{icon}</span>
                      </div>
                      <div className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/4 border border-slate-300 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 transition-colors">
                        <span className="text-xs font-bold text-slate-700 dark:text-white/80 leading-snug">
                          {ach}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Tournament history */}
        {player.tournamentHistory.length > 0 && (
          <div
            className={
              validAchievements.length > 0
                ? "pt-5 border-t border-slate-200 dark:border-white/8"
                : ""
            }
          >
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-white/35 mb-4 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-blue-500" /> Tournaments
            </h3>
            <div className="relative ml-5 space-y-2.5">
              <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-blue-500/50 to-indigo-500/50 rounded-full" />
              {[...player.tournamentHistory]
                .sort((a, b) => {
                  const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  return yearA !== yearB ? yearB - yearA : a.localeCompare(b);
                })
                .map((t, idx) => (
                  <div key={idx} className="relative flex gap-3 items-center">
                    <div className="relative -ml-[11px] shrink-0 w-6 h-6 rounded-full bg-blue-500/10 ring-2 ring-blue-500/25 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                    <div className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-white/4 border border-slate-300 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 transition-colors">
                      <span className="text-xs font-bold text-slate-700 dark:text-white/80">
                        {t}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </motion.section>

      <motion.section variants={itemVariants}>
        <PlayerEndorsementsWidget playerId={player.userId || player.id} />
      </motion.section>
    </>
  );
}
