import { motion } from "framer-motion";
import {
  Crosshair,
  Zap,
  User,
  Sparkles,
  Activity,
  Flame,
  Trophy,
  Swords,
} from "lucide-react";
import type { PlayerProfileType } from "@/types";
import { InfoModal } from "@/components/InfoModal";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function FormPill({ result, index }: { result: "W" | "L"; index: number }) {
  const isWin = result === "W";
  const opacity = 1 - index * 0.15;
  return (
    <div
      className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black
        ${isWin ? "bg-primary text-white" : "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-white/40"}
      `}
      style={{ opacity }}
    >
      {result}
    </div>
  );
}

function CategoryBar({
  label,
  wins,
  losses,
  color,
}: {
  label: string;
  wins: number;
  losses: number;
  color: string;
}) {
  const total = wins + losses;
  const pct = total === 0 ? 0 : Math.round((wins / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-black">
        <span className="uppercase tracking-widest text-slate-600 dark:text-white/70">
          {label}
        </span>
        <span className="text-slate-400 dark:text-white/40">{total} matches</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden flex">
        {total > 0 && (
          <motion.div
            className={`h-full ${color}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-white/40">
        <span>{wins}W</span>
        <span>{pct}% Win Rate</span>
        <span>{losses}L</span>
      </div>
    </div>
  );
}

function CircularProgress({
  value,
  size = 60,
  stroke = 4,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-slate-200 dark:text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-xs font-black text-slate-700 dark:text-white">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

interface ProfileOverviewTabProps {
  player: PlayerProfileType;
  splitStats: any;
  streakStats: { max: number; current: number };
  bestOpponent: any;
  MatchHistorySection: any;
  EquipmentArsenalSection: any;
  CareerHighlightsSection: any;
  id: string;
  liveMatches: any[];
  ownPlayerProfile: PlayerProfileType | null | undefined;
  handleWithdrawMatch: (id: string) => void;
  handleConfirmMatch: (id: string) => void;
  handleRejectMatch: (id: string) => void;
  handleResendRequest: (id: string) => void;
}

export function ProfileOverviewTab({
  player,
  splitStats,
  streakStats,
  bestOpponent,
  MatchHistorySection,
  EquipmentArsenalSection,
  CareerHighlightsSection,
  id,
  liveMatches,
  ownPlayerProfile,
  handleWithdrawMatch,
  handleConfirmMatch,
  handleRejectMatch,
  handleResendRequest,
}: ProfileOverviewTabProps) {
  const streak = splitStats?.all?.streak;
  const isWinStreak = streak?.startsWith("W");

  return (
    <div className="space-y-8">
      {/* Split Stats (Friendly / Tournament / Overall) */}
      {splitStats && splitStats.all.total > 0 && (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary/[0.05] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-white/35 flex items-center gap-1.5">
                    Overall
                    <InfoModal
                      title="OVERALL STATS"
                      items={[
                        { badge: "WINS", title: "Total Wins", desc: "Your combined win rate across all match types, including Friendlies and Tournaments." },
                        { badge: "STREAKS", title: "Current Streak", desc: "Winning matches back-to-back will build a hot streak, increasing your momentum on the courts!" }
                      ]}
                    />
                  </span>
                  <CircularProgress
                    value={splitStats.all.winPct}
                    size={44}
                    stroke={4}
                  />
                </div>
                <div className="text-3xl font-black text-white tabular-nums mb-1">
                  <span className="text-primary">{splitStats.all.wins}W</span>
                  <span className="text-white/20 mx-1.5 font-light">·</span>
                  <span className="text-rose-500">{splitStats.all.losses}L</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-white/35 font-medium">
                  {splitStats.all.total} matches total
                </div>
                {streak && (
                  <div
                    className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${
                      isWinStreak
                        ? "bg-primary/15 text-primary"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    <Flame className="w-3 h-3" /> {streak} streak
                  </div>
                )}
                {streakStats.max > 0 && (
                  <div
                    className="mt-3 ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-orange-500/15 text-orange-400"
                    title="All-Time Best Win Streak"
                  >
                    <Trophy className="w-3 h-3" /> Max {streakStats.max}W
                  </div>
                )}
                {bestOpponent && (
                  <div className="mt-2 text-[10px] text-slate-500 dark:text-white/40 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                    <Swords className="w-3 h-3 text-indigo-400" /> Best win vs{" "}
                    {bestOpponent.full_name} ({bestOpponent.elo_rating})
                  </div>
                )}
              </div>
            </div>

            {/* Friendly */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/50 to-primary" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-primary/[0.12] flex items-center justify-center text-base shrink-0">
                    🏸
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                    Friendly
                  </span>
                </div>
                <div className="text-3xl font-black text-white tabular-nums mb-1">
                  {splitStats.friendly.wins}W
                  <span className="text-white/20 font-light mx-1">–</span>
                  {splitStats.friendly.losses}L
                </div>
                <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                  {splitStats.friendly.total} matches · {splitStats.friendly.winPct}% win
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${splitStats.friendly.winPct}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
                {splitStats.friendly.recentForm.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-500 dark:text-white/35 mr-0.5">
                      Form
                    </span>
                    {splitStats.friendly.recentForm.map((r: any, i: number) => (
                      <FormPill key={i} result={r} index={i} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tournament */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-300 to-orange-500" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/[0.12] flex items-center justify-center text-base shrink-0">
                    🏆
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                    Tournament
                  </span>
                </div>
                {splitStats.tournament.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-white tabular-nums mb-1">
                      {splitStats.tournament.wins}W
                      <span className="text-white/20 font-light mx-1">–</span>
                      {splitStats.tournament.losses}L
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                      {splitStats.tournament.total} matches ·{" "}
                      {splitStats.tournament.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.tournament.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                    {splitStats.tournament.recentForm.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-500 dark:text-white/35 mr-0.5">
                          Form
                        </span>
                        {splitStats.tournament.recentForm.map((r: any, i: number) => (
                          <FormPill key={i} result={r} index={i} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-white/35 italic">
                    No tournament matches yet
                  </div>
                )}
              </div>
            </div>

            {/* Singles */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-300 to-blue-500" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-blue-500/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/[0.12] flex items-center justify-center text-base shrink-0">
                    👤
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                    Singles
                  </span>
                </div>
                {splitStats.singles.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-white tabular-nums mb-1">
                      {splitStats.singles.wins}W
                      <span className="text-white/20 font-light mx-1">–</span>
                      {splitStats.singles.losses}L
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                      {splitStats.singles.total} matches · {splitStats.singles.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.singles.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-white/35 italic">
                    No singles matches
                  </div>
                )}
              </div>
            </div>

            {/* Doubles */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-300 to-purple-500" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-purple-500/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/[0.12] flex items-center justify-center text-base shrink-0">
                    👥
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">
                    Doubles
                  </span>
                </div>
                {splitStats.doubles.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-white tabular-nums mb-1">
                      {splitStats.doubles.wins}W
                      <span className="text-white/20 font-light mx-1">–</span>
                      {splitStats.doubles.losses}L
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                      {splitStats.doubles.total} matches · {splitStats.doubles.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.doubles.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-white/35 italic">
                    No doubles matches
                  </div>
                )}
              </div>
            </div>

            {/* Mixed */}
            <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-300 to-rose-500" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-rose-500/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/[0.12] flex items-center justify-center text-base shrink-0">
                    👫
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-400">
                    Mixed
                  </span>
                </div>
                {splitStats.mixed.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-white tabular-nums mb-1">
                      {splitStats.mixed.wins}W
                      <span className="text-white/20 font-light mx-1">–</span>
                      {splitStats.mixed.losses}L
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                      {splitStats.mixed.total} matches · {splitStats.mixed.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.mixed.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-white/35 italic">
                    No mixed matches
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Player Attributes */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
            Player Attributes
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {(
            [
              {
                Icon: Crosshair,
                label: "Playing Style",
                value: player.playingStyle,
                accent: "from-amber-400 to-orange-500",
                iconBg: "bg-amber-500/[0.12]",
                iconColor: "text-amber-500",
              },
              {
                Icon: Zap,
                label: "Signature Shot",
                value: player.favoriteShot,
                accent: "from-rose-400 to-pink-500",
                iconBg: "bg-rose-500/[0.12]",
                iconColor: "text-rose-500",
              },
              {
                Icon: User,
                label: "Dominant Hand",
                value: player.dominantHand,
                accent: "from-blue-400 to-cyan-500",
                iconBg: "bg-blue-500/[0.12]",
                iconColor: "text-blue-500",
              },
              {
                Icon: Sparkles,
                label: "Badminton Idol",
                value: player.favoriteIdol,
                accent: "from-violet-400 to-purple-500",
                iconBg: "bg-violet-500/[0.12]",
                iconColor: "text-violet-500",
              },
              {
                Icon: Activity,
                label: "Favorite Format",
                value: player.favoriteFormat,
                accent: "from-primary to-teal-500",
                iconBg: "bg-primary/[0.12]",
                iconColor: "text-primary",
              },
            ] as const
          ).map((attr) => (
            <div
              key={attr.label}
              className="relative overflow-hidden bg-white/5 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/14 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${attr.accent}`}
              />
              <div
                className={`w-9 h-9 rounded-xl ${attr.iconBg} flex items-center justify-center mb-4`}
              >
                <attr.Icon className={`w-4 h-4 ${attr.iconColor}`} />
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-white/35 mb-1.5 uppercase tracking-wider">
                {attr.label}
              </div>
              <div className="text-sm sm:text-base font-black text-slate-800 dark:text-white/90 leading-snug">
                {attr.value}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Performance Breakdown */}
      {player.stats?.categoryStats && (
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
              Performance Breakdown
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
          </div>
          <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-blue-500 to-blue-700" />
            {player.stats.categoryStats.singles && (
              <CategoryBar
                label="Singles"
                wins={player.stats.categoryStats.singles.wins}
                losses={player.stats.categoryStats.singles.losses}
                color="bg-primary"
              />
            )}
            {player.stats.categoryStats.doubles && (
              <CategoryBar
                label="Doubles"
                wins={player.stats.categoryStats.doubles.wins}
                losses={player.stats.categoryStats.doubles.losses}
                color="bg-blue-500"
              />
            )}
            {player.stats.categoryStats.mixed && (
              <CategoryBar
                label="Mixed"
                wins={player.stats.categoryStats.mixed.wins}
                losses={player.stats.categoryStats.mixed.losses}
                color="bg-violet-500"
              />
            )}
          </div>
        </motion.section>
      )}

      {/* Match History */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0 flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Match
          History
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
      </div>
      <MatchHistorySection
        id={id}
        liveMatches={liveMatches}
        ownPlayerProfile={ownPlayerProfile}
        handleWithdrawMatch={handleWithdrawMatch}
        handleConfirmMatch={handleConfirmMatch}
        handleRejectMatch={handleRejectMatch}
        handleResendRequest={handleResendRequest}
      />

      {/* Equipment Arsenal */}
      <EquipmentArsenalSection player={player} />

      {/* Career Highlights */}
      <CareerHighlightsSection player={player} />
    </div>
  );
}
