import { motion } from "framer-motion";
import { Quote, Trophy, Calendar, BookOpen, Medal, Swords } from "lucide-react";
import type { PlayerRow } from "@/types";
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
  player: PlayerRow;
  validAchievements: string[];
  splitStats?: any;
  tournamentRuns?: TournamentRun[];
}) {
  const dynamicWins = splitStats?.all?.wins ?? 0;
  const dynamicLosses = splitStats?.all?.losses ?? 0;
  const displayRecord = (dynamicWins > 0 || dynamicLosses > 0)
    ? `${dynamicWins}W - ${dynamicLosses}L`
    : player.win_loss_record || "0W - 0L";
  return (
    <>
      {/* Quote */}
      {player.quote && (
        <motion.div variants={itemVariants} className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-info/20 to-warning rounded-[1.75rem] blur opacity-25 group-hover:opacity-50 transition duration-500" />
          <div className="relative bg-gradient-to-br from-[#1a3a7a] via-[#0f2347] to-background rounded-[1.75rem] p-7 shadow-lg shadow-info/40 overflow-hidden border border-warning/20">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-warning/0 via-warning/50 to-warning/0" />
            <Quote className="absolute -bottom-3 -right-3 w-24 h-24 text-warning/[0.12] -rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-base sm:text-lg font-serif italic text-foreground/85 leading-snug">
                "{player.quote}"
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bio & Details */}
      {(player.bio || player.coach || player.started_playing_year != null || player.highest_ranking != null || player.favorite_format) && (
        <motion.section
          variants={itemVariants}
          className="bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-info to-accent" />
          <h2 className="text-[10px] font-black text-foreground/60 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-warning" />{" "}
            About
          </h2>
          {player.bio && (
            <p className="text-sm leading-relaxed text-foreground/65">
              {player.bio}
            </p>
          )}
          {(player.coach ||
            player.started_playing_year != null ||
            player.highest_ranking != null ||
            player.favorite_format) && (
            <div className={`${player.bio ? "mt-4 pt-4 border-t border-foreground/8" : ""} space-y-2.5`}>
              {player.coach && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60 font-medium">
                    Coach
                  </span>
                  <span className="font-bold text-foreground/90">
                    {player.coach}
                  </span>
                </div>
              )}
              {player.favorite_format && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60 font-medium">
                    Favorite Format
                  </span>
                  <span className="font-bold text-foreground/90">
                    {player.favorite_format}
                  </span>
                </div>
              )}
              {player.started_playing_year != null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60 font-medium">
                    Years Playing
                  </span>
                  <span className="font-bold text-foreground/90">
                    {new Date().getFullYear() - player.started_playing_year} yrs
                  </span>
                </div>
              )}
              {player.highest_ranking != null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground/60 font-medium">
                    Career-High Rank
                  </span>
                  <span className="font-bold text-foreground/90">
                    #{player.highest_ranking}
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
        className="bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-warning to-secondary" />
        <h2 className="text-[10px] font-black text-foreground/60 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-gold" /> Career Record
        </h2>

        {/* W/L block */}
        <div className="mb-6 p-5 bg-media/40 rounded-xl relative overflow-hidden border border-foreground/6">
          <div className="absolute inset-0 bg-gradient-to-r from-warning/[0.08] to-transparent" />
          <div className="relative z-10">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-warning mb-2">
              Overall W/L
            </div>
            <div className="text-2xl font-black text-foreground">
              {displayRecord}
            </div>
          </div>
        </div>

        {/* Bracket Record */}
        {tournamentRuns && tournamentRuns.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/60 mb-3 flex items-center gap-1.5">
              <Swords className="w-3 h-3 text-primary" /> Bracket Record
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
                    className="rounded-xl border border-foreground/6 bg-foreground/[0.03] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-foreground/85 truncate leading-tight">
                          {run.tournament_name}
                        </p>
                        <p className="text-[9px] text-foreground/60 uppercase tracking-wider">
                          {run.category}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold shrink-0 px-2 py-0.5 rounded-full ${run.eliminated ? "bg-foreground/8 text-foreground/60" : "bg-primary/15 text-primary"}`}>
                        {resultLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${winPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-foreground/60 shrink-0">
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
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/60 mb-4 flex items-center gap-1.5">
              <Medal className="w-3 h-3 text-gold" />{" "}
              Achievements
            </h3>
            <div className="relative ml-5 space-y-3">
              <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-warning/70 via-warning/40 to-warning/60 rounded-full" />
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
                    ? "bg-gold/10 ring-gold/25"
                    : isSilver
                    ? "bg-foreground/8 ring-foreground/20"
                    : isBronze
                    ? "bg-secondary/10 ring-secondary/25"
                    : "bg-primary/10 ring-primary/25";
                  return (
                    <div key={idx} className="relative flex gap-3 items-start">
                      <div
                        className={`relative -ml-[18px] mt-0.5 shrink-0 w-8 h-8 rounded-full ${bg} ring-2 flex items-center justify-center shadow-sm`}
                      >
                        <span className="text-xs">{icon}</span>
                      </div>
                      <div className="flex-1 py-2 px-3 rounded-xl bg-foreground bg-foreground/4 border border-foreground/6 hover:bg-soft bg-foreground/8 transition-colors">
                        <span className="text-xs font-bold text-foreground/80 leading-snug">
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
        {(player.tournament_history?.length ?? 0) > 0 && (
          <div
            className={
              validAchievements.length > 0
                ? "pt-5 border-t border-foreground/8"
                : ""
            }
          >
            <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/60 mb-4 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-info" /> Tournaments
            </h3>
            <div className="relative ml-5 space-y-2.5">
              <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-info/50 to-info/50 rounded-full" />
              {[...(player.tournament_history || [])]
                .sort((a, b) => {
                  const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                  return yearA !== yearB ? yearB - yearA : a.localeCompare(b);
                })
                .map((t, idx) => (
                  <div key={idx} className="relative flex gap-3 items-center">
                    <div className="relative -ml-[11px] shrink-0 w-6 h-6 rounded-full bg-info/10 ring-2 ring-info/25 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-info" />
                    </div>
                    <div className="flex-1 py-1.5 px-3 rounded-xl bg-foreground bg-foreground/4 border border-foreground/6 hover:bg-soft bg-foreground/8 transition-colors">
                      <span className="text-xs font-bold text-foreground/80">
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
        <PlayerEndorsementsWidget playerId={player.id} />
      </motion.section>
    </>
  );
}
