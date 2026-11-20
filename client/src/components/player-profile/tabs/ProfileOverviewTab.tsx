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
import type { PlayerRow } from "@/types";
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
        ${isWin ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-primary-foreground/40"}
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
        <span className="uppercase tracking-widest text-foreground/70">
          {label}
        </span>
        <span className="text-foreground/60">{total} matches</span>
      </div>
      <div className="h-2 w-full rounded-full bg-foreground/5 overflow-hidden flex">
        {total > 0 && (
          <motion.div
            className={`h-full ${color}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold text-foreground/60">
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
          className="text-foreground/10"
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
        <span className="text-xs font-black text-foreground">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

interface ProfileOverviewTabProps {
  player: PlayerRow;
  splitStats: any;
  streakStats: { max: number; current: number };
  bestOpponent: any;
  MatchHistorySection: any;
  EquipmentArsenalSection: any;
  CareerHighlightsSection: any;
  id: string;
  liveMatches: any[];
  ownPlayerProfile: PlayerRow | null | undefined;
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
}: ProfileOverviewTabProps) {
  const streak = splitStats?.all?.streak;
  const isWinStreak = streak?.startsWith("W");

  return (
    <div className="space-y-6">
      {/* Split Stats (Friendly / Tournament / Overall) */}
      {splitStats && splitStats.all.total > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex flex-wrap gap-4">
            {/* Overall */}
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-warning via-warning to-warning" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary/[0.05] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/60 flex items-center gap-1.5">
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
                <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                  <span className="text-primary">{splitStats.all.wins}W</span>
                  <span className="text-foreground/50 mx-1.5 font-light">·</span>
                  <span className="text-danger">{splitStats.all.losses}L</span>
                </div>
                <div className="text-xs text-foreground/60 font-medium">
                  {splitStats.all.total} matches total
                </div>
                {streak && (
                  <div
                    className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${
                      isWinStreak
                        ? "bg-primary/15 text-primary"
                        : "bg-danger/15 text-danger"
                    }`}
                  >
                    <Flame className="w-3 h-3" /> {streak} streak
                  </div>
                )}
                {streakStats.max > 0 && (
                  <div
                    className="mt-3 ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-secondary/15 text-secondary"
                    title="All-Time Best Win Streak"
                  >
                    <Trophy className="w-3 h-3" /> Max {streakStats.max}W
                  </div>
                )}
                {bestOpponent && (
                  <div className="mt-2 text-[10px] text-foreground/60 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                    <Swords className="w-3 h-3 text-info" /> Best win vs{" "}
                    {bestOpponent.full_name} ({bestOpponent.elo_rating})
                  </div>
                )}
              </div>
            </div>

            {/* Friendly */}
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
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
                <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                  {splitStats.friendly.wins}W
                  <span className="text-foreground/50 font-light mx-1">–</span>
                  {splitStats.friendly.losses}L
                </div>
                <div className="text-xs text-foreground/60 font-medium mb-2">
                  {splitStats.friendly.total} matches · {splitStats.friendly.winPct}% win
                </div>
                <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-team"
                    initial={{ width: 0 }}
                    animate={{ width: `${splitStats.friendly.winPct}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
                {splitStats.friendly.recentForm.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] uppercase tracking-[0.15em] font-black text-foreground/60 mr-0.5">
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
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-success to-success" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-warning/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-warning/[0.12] flex items-center justify-center text-base shrink-0">
                    🏆
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-warning">
                    Tournament
                  </span>
                </div>
                {splitStats.tournament.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                      {splitStats.tournament.wins}W
                      <span className="text-foreground/50 font-light mx-1">–</span>
                      {splitStats.tournament.losses}L
                    </div>
                    <div className="text-xs text-foreground/60 font-medium mb-2">
                      {splitStats.tournament.total} matches ·{" "}
                      {splitStats.tournament.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-warning to-secondary"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.tournament.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                    {splitStats.tournament.recentForm.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] uppercase tracking-[0.15em] font-black text-foreground/60 mr-0.5">
                          Form
                        </span>
                        {splitStats.tournament.recentForm.map((r: any, i: number) => (
                          <FormPill key={i} result={r} index={i} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-foreground/60 italic">
                    No tournament matches yet
                  </div>
                )}
              </div>
            </div>

            {/* Singles */}
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-info to-info" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-info/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-info/[0.12] flex items-center justify-center text-base shrink-0">
                    👤
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-info">
                    Singles
                  </span>
                </div>
                {splitStats.singles.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                      {splitStats.singles.wins}W
                      <span className="text-foreground/50 font-light mx-1">–</span>
                      {splitStats.singles.losses}L
                    </div>
                    <div className="text-xs text-foreground/60 font-medium mb-2">
                      {splitStats.singles.total} matches · {splitStats.singles.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-info to-info"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.singles.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-foreground/60 italic">
                    No singles matches
                  </div>
                )}
              </div>
            </div>

            {/* Doubles */}
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-individual to-individual" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-individual/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-individual/[0.12] flex items-center justify-center text-base shrink-0">
                    👥
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-individual">
                    Doubles
                  </span>
                </div>
                {splitStats.doubles.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                      {splitStats.doubles.wins}W
                      <span className="text-foreground/50 font-light mx-1">–</span>
                      {splitStats.doubles.losses}L
                    </div>
                    <div className="text-xs text-foreground/60 font-medium mb-2">
                      {splitStats.doubles.total} matches · {splitStats.doubles.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-individual to-individual"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.doubles.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-foreground/60 italic">
                    No doubles matches
                  </div>
                )}
              </div>
            </div>

            {/* Mixed */}
            <div className="flex-1 min-w-[280px] bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-danger to-danger" />
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-danger/[0.04] rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-danger/[0.12] flex items-center justify-center text-base shrink-0">
                    👫
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-danger">
                    Mixed
                  </span>
                </div>
                {splitStats.mixed.total > 0 ? (
                  <>
                    <div className="text-3xl font-black text-foreground tabular-nums mb-1">
                      {splitStats.mixed.wins}W
                      <span className="text-foreground/50 font-light mx-1">–</span>
                      {splitStats.mixed.losses}L
                    </div>
                    <div className="text-xs text-foreground/60 font-medium mb-2">
                      {splitStats.mixed.total} matches · {splitStats.mixed.winPct}% win
                    </div>
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-3">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-danger to-individual"
                        initial={{ width: 0 }}
                        animate={{ width: `${splitStats.mixed.winPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-foreground/60 italic">
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
          <div className="h-px flex-1 bg-foreground/8" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/60 shrink-0">
            Player Attributes
          </span>
          <div className="h-px flex-1 bg-foreground/8" />
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {(
            [
              {
                Icon: Crosshair,
                label: "Playing Style",
                value: player.playing_style,
                accent: "from-warning to-secondary",
                iconBg: "bg-warning/[0.12]",
                iconColor: "text-warning",
              },
              {
                Icon: Zap,
                label: "Signature Shot",
                value: player.favorite_shot,
                accent: "from-danger to-individual",
                iconBg: "bg-danger/[0.12]",
                iconColor: "text-danger",
              },
              {
                Icon: User,
                label: "Dominant Hand",
                value: player.dominant_hand,
                accent: "from-info to-accent",
                iconBg: "bg-info/[0.12]",
                iconColor: "text-info",
              },
              {
                Icon: Sparkles,
                label: "Badminton Idol",
                value: player.favorite_idol,
                accent: "from-individual to-individual",
                iconBg: "bg-individual/[0.12]",
                iconColor: "text-individual",
              },
              {
                Icon: Activity,
                label: "Favorite Format",
                value: player.favorite_format,
                accent: "from-primary to-team",
                iconBg: "bg-primary/[0.12]",
                iconColor: "text-primary",
              },
            ] as const
          ).filter(attr => Boolean(attr.value)).map((attr) => (
            <div
              key={attr.label}
              className={`flex-1 min-w-[140px] relative overflow-hidden bg-foreground/8 rounded-2xl p-5 sm:p-6 border border-foreground/8 hover:border-foreground/14 hover:bg-foreground/12 hover:-translate-y-0.5 transition-all duration-300 group ${
                attr.label === "Favorite Format" ? "flex flex-col items-center text-center" : ""
              }`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${attr.accent}`}
              />
              <div
                className={`w-9 h-9 rounded-xl ${attr.iconBg} flex items-center justify-center mb-4`}
              >
                <attr.Icon className={`w-4 h-4 ${attr.iconColor}`} />
              </div>
              <div className="text-[10px] font-bold text-foreground/60 mb-1.5 uppercase tracking-wider">
                {attr.label}
              </div>
              <div className="text-sm sm:text-base font-black text-foreground/90 leading-snug break-words hyphens-auto">
                {attr.value}
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Performance Breakdown */}
      {(splitStats?.singles?.total > 0 || splitStats?.doubles?.total > 0 || splitStats?.mixed?.total > 0) && (
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-foreground/8" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/60 shrink-0">
              Performance Breakdown
            </span>
            <div className="h-px flex-1 bg-foreground/8" />
          </div>
          <div className="bg-foreground/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-foreground/8 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-warning via-info to-info" />
            {splitStats.singles && splitStats.singles.total > 0 && (
              <CategoryBar
                label="Singles"
                wins={splitStats.singles.wins}
                losses={splitStats.singles.losses}
                color="bg-primary"
              />
            )}
            {splitStats.doubles && splitStats.doubles.total > 0 && (
              <CategoryBar
                label="Doubles"
                wins={splitStats.doubles.wins}
                losses={splitStats.doubles.losses}
                color="bg-info"
              />
            )}
            {splitStats.mixed && splitStats.mixed.total > 0 && (
              <CategoryBar
                label="Mixed"
                wins={splitStats.mixed.wins}
                losses={splitStats.mixed.losses}
                color="bg-individual"
              />
            )}
          </div>
        </motion.section>
      )}

      {/* Match History */}
      {liveMatches.some((m) => m.status === "confirmed" || m.status === "pending") && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-foreground/8" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/60 shrink-0 flex items-center gap-2">
              <Swords className="w-3.5 h-3.5 text-warning" /> Match
              History
            </span>
            <div className="h-px flex-1 bg-foreground/8" />
          </div>
          <MatchHistorySection
            id={id}
            liveMatches={liveMatches}
            ownPlayerProfile={ownPlayerProfile}
          />
        </>
      )}

      {/* Equipment Arsenal */}
      <EquipmentArsenalSection player={player} />

      {/* Career Highlights */}
      <CareerHighlightsSection player={player} />
    </div>
  );
}
