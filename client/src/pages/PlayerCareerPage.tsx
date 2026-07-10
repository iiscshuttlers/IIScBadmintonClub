import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  ActivitySquare,
  Zap,
  Footprints,
  Gauge,
  Swords,
  BarChart3,
  TrendingUp,
  Flame,
  AlertTriangle,
  Users,
  Home,
  Target,
  Dumbbell,
  User,
  TrendingDown,
  Sigma,
  UserPlus,
  ChevronUp,
  ArrowUpRight,
  Search,
  Moon,
  Sun,
  Shield,
  LogOut,
  Lock,
  Settings,
  Trash2,
  ZoomIn,
  ZoomOut,
  X as CloseIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { usePlayerCareer, type CareerMatch, type MotionMatch } from "@/hooks/usePlayerCareer";
import { useHealthData } from "@/hooks/useHealthData";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { fetchPlayer } from "@/services/playerService";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingScreen } from "@/components/player-profile/PlayerProfileWidgets";
import { StatCard } from "@/components/personal/StatCard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { useAppMode } from "@/contexts/AppModeContext";

const MAIN_TABS = ["Home", "Matches", "Growth", "Stats", "Training", "Me"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const FORMAT_TABS = ["Singles", "Doubles", "Mixed Doubles"] as const;
type FormatTab = (typeof FORMAT_TABS)[number];

const STATUS_CONFIG = [
  { id: "looking", short: "Available", dot: "bg-primary", active: "bg-primary/20 text-primary dark:text-primary/70 ring-1 ring-primary/40" },
  { id: "playing", short: "Playing", dot: "bg-amber-400", active: "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40" },
  { id: "resting", short: "Resting", dot: "bg-indigo-400", active: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400/40" },
  { id: "injured", short: "Injured", dot: "bg-rose-400", active: "bg-rose-500/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/40" },
] as const;

function MotionStatBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-slate-700 dark:text-slate-200">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function IntensityTrendChart({ motionMatches }: { motionMatches: MotionMatch[] }) {
  const data = useMemo(
    () =>
      motionMatches.map((m) => ({
        date: m.scoredAt
          ? new Date(m.scoredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "—",
        workRate: Math.round(m.workRate * 10) / 10,
        tournamentName: m.tournamentName,
        result: m.won === null ? "-" : m.won ? "W" : "L",
      })),
    [motionMatches]
  );

  if (data.length < 2) return null;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} minTickGap={30} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
          <Tooltip
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <div className="bg-slate-900/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground font-medium mb-1">{payload[0].payload.tournamentName}</p>
                  <p className="text-sm font-black text-foreground">Work-rate: {payload[0].payload.workRate}</p>
                </div>
              ) : null
            }
            cursor={{ stroke: "#475569", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Line
            type="monotone"
            dataKey="workRate"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={{ r: 3, fill: "#1e293b", stroke: "#f59e0b", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
            animationDuration={1200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonRow({ label, a, b, aLabel, bLabel }: { label: string; a: number; b: number; aLabel: string; bLabel: string }) {
  const max = Math.max(a, b, 1);
  return (
    <div>
      <div className="text-xs font-bold text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-10 text-right text-[10px] font-black text-blue-500">{aLabel}</div>
        <div className="flex-1 flex items-center gap-0.5">
          <div className="flex-1 flex justify-end">
            <div className="h-2.5 rounded-l-full bg-blue-400" style={{ width: `${(a / max) * 100}%` }} />
          </div>
          <div className="flex-1">
            <div className="h-2.5 rounded-r-full bg-rose-500" style={{ width: `${(b / max) * 100}%` }} />
          </div>
        </div>
        <div className="w-10 text-[10px] font-black text-rose-500">{bLabel}</div>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] font-bold text-blue-500">{a.toFixed(0)}%</span>
        <span className="text-[10px] font-bold text-rose-500">{b.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function MotionAnalyticsPanels({ motionMatches }: { motionMatches: MotionMatch[] }) {
  const winLoss = useMemo(() => {
    const wins = motionMatches.filter((m) => m.won === true);
    const losses = motionMatches.filter((m) => m.won === false);
    if (wins.length === 0 || losses.length === 0) return null;
    const avg = (arr: MotionMatch[], key: keyof MotionMatch) =>
      (arr.reduce((s, m) => s + (m[key] as number), 0) / arr.length) as number;
    return {
      winsCount: wins.length,
      lossesCount: losses.length,
      runningWin: avg(wins, "runningPct"),
      runningLoss: avg(losses, "runningPct"),
      smashWin: avg(wins, "smashSprintPct"),
      smashLoss: avg(losses, "smashSprintPct"),
    };
  }, [motionMatches]);

  const formatCompare = useMemo(() => {
    const singles = motionMatches.filter((m) => m.group === "Singles");
    const doubles = motionMatches.filter((m) => m.group !== "Singles");
    if (singles.length === 0 || doubles.length === 0) return null;
    const avg = (arr: MotionMatch[], key: keyof MotionMatch) =>
      (arr.reduce((s, m) => s + (m[key] as number), 0) / arr.length) as number;
    return {
      singlesCount: singles.length,
      doublesCount: doubles.length,
      runningSingles: avg(singles, "runningPct"),
      runningDoubles: avg(doubles, "runningPct"),
      smashSingles: avg(singles, "smashSprintPct"),
      smashDoubles: avg(doubles, "smashSprintPct"),
    };
  }, [motionMatches]);

  const mostIntense = useMemo(() => {
    if (motionMatches.length === 0) return null;
    return motionMatches.reduce((best, m) => (m.workRate > best.workRate ? m : best), motionMatches[0]);
  }, [motionMatches]);

  const lowQualityCount = useMemo(
    () => motionMatches.filter((m) => m.sampleCount > 0 && m.sampleCount < 20).length,
    [motionMatches]
  );

  return (
    <div className="space-y-4 mt-4">
      {motionMatches.length >= 2 && (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <h2 className="font-black text-slate-800 dark:text-slate-100">Intensity Trend</h2>
          </div>
          <IntensityTrendChart motionMatches={motionMatches} />
        </div>
      )}

      {mostIntense && (
        <div className="bg-gradient-to-br from-rose-500/10 to-amber-500/10 rounded-2xl shadow-md border border-rose-200 dark:border-rose-800/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-rose-500" />
            <h2 className="font-black text-slate-800 dark:text-slate-100">Most Intense Match</h2>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{mostIntense.tournamentName}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs font-bold text-muted-foreground">
            <span>{mostIntense.smashSprintPct.toFixed(0)}% smash-sprint</span>
            <span>{mostIntense.runningPct.toFixed(0)}% running</span>
            <span>peak {mostIntense.maxMagnitude.toFixed(1)}</span>
          </div>
        </div>
      )}

      {(winLoss || formatCompare) && (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-black text-slate-800 dark:text-slate-100">Movement Comparisons</h2>
          </div>
          {winLoss && (
            <div className="space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Wins ({winLoss.winsCount}) vs Losses ({winLoss.lossesCount})
              </div>
              <ComparisonRow label="Running" a={winLoss.runningWin} b={winLoss.runningLoss} aLabel="Win" bLabel="Loss" />
              <ComparisonRow label="Smash Sprint" a={winLoss.smashWin} b={winLoss.smashLoss} aLabel="Win" bLabel="Loss" />
            </div>
          )}
          {formatCompare && (
            <div className="space-y-2.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Singles ({formatCompare.singlesCount}) vs Doubles ({formatCompare.doublesCount})
              </div>
              <ComparisonRow
                label="Running"
                a={formatCompare.runningSingles}
                b={formatCompare.runningDoubles}
                aLabel="Sing."
                bLabel="Dbl."
              />
              <ComparisonRow
                label="Smash Sprint"
                a={formatCompare.smashSingles}
                b={formatCompare.smashDoubles}
                aLabel="Sing."
                bLabel="Dbl."
              />
            </div>
          )}
        </div>
      )}

      {lowQualityCount > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            {lowQualityCount} tracked match{lowQualityCount === 1 ? "" : "es"} had a low sample count — those readings may be less reliable.
          </span>
        </div>
      )}
    </div>
  );
}

function HomeSection({ player, matches, fullMatches, currentUser }: { player: any; matches: CareerMatch[]; fullMatches: any[]; currentUser: any }) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { matches: allMatches } = usePlayerMatches(player?.id);

  const stats = useMemo(() => {
    const isWinner = (m: any) => {
      const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    };

    const matches = allMatches || [];
    const total = matches.length;
    const wins = matches.filter(isWinner).length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;

    const getForm = (arr: any[]) => {
      const recent = arr.slice(0, 10).map(m => isWinner(m) ? "W" : "L").reverse();
      return recent.length > 0 ? recent.join(" ") : "No matches";
    };

    const streak = getForm(matches);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const thisWeekMatches = matches.filter((m) => (m.date || m.created_at || "") >= weekAgo);
    const thisWeek = thisWeekMatches.length;
    const thisWeekWins = thisWeekMatches.filter(isWinner).length;
    const thisWeekWinRate = thisWeek > 0 ? Math.round((thisWeekWins / thisWeek) * 100) : null;

    const friendlyMatches = matches.filter((m) => m.is_friendly !== false);
    const tournamentMatches = matches.filter((m) => m.is_friendly === false);
    const friendlyWins = friendlyMatches.filter(isWinner).length;
    const tournamentWins = tournamentMatches.filter(isWinner).length;

    const friendlySingles = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("singles"));
    const friendlyDoubles = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("doubles") && !m.category?.toLowerCase().includes("mixed"));
    const friendlyMixed = friendlyMatches.filter((m) => m.category?.toLowerCase().includes("mixed"));
    
    const tournamentSingles = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("singles"));
    const tournamentDoubles = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("doubles") && !m.category?.toLowerCase().includes("mixed"));
    const tournamentMixed = tournamentMatches.filter((m) => m.category?.toLowerCase().includes("mixed"));

    return {
      wins,
      losses: total - wins,
      total,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(0) : "0",
      streak,
      thisWeek,
      thisWeekWinRate,
      elo: Math.round(player?.elo_rating ?? 1200),
      singlesElo: Math.round(player?.singles_elo ?? 1200),
      doublesElo: Math.round(player?.doubles_elo ?? 1200),
      mixedElo: Math.round(player?.mixed_elo ?? 1200),
      tournamentElo: Math.round(player?.tournament_elo ?? 1200),
      friendly: { total: friendlyMatches.length, wins: friendlyWins, form: getForm(friendlyMatches) },
      tournament: { total: tournamentMatches.length, wins: tournamentWins, form: getForm(tournamentMatches) },
      friendlySingles: { total: friendlySingles.length, wins: friendlySingles.filter(isWinner).length, form: getForm(friendlySingles) },
      friendlyDoubles: { total: friendlyDoubles.length, wins: friendlyDoubles.filter(isWinner).length, form: getForm(friendlyDoubles) },
      friendlyMixed: { total: friendlyMixed.length, wins: friendlyMixed.filter(isWinner).length, form: getForm(friendlyMixed) },
      tournamentSingles: { total: tournamentSingles.length, wins: tournamentSingles.filter(isWinner).length, form: getForm(tournamentSingles) },
      tournamentDoubles: { total: tournamentDoubles.length, wins: tournamentDoubles.filter(isWinner).length, form: getForm(tournamentDoubles) },
      tournamentMixed: { total: tournamentMixed.length, wins: tournamentMixed.filter(isWinner).length, form: getForm(tournamentMixed) },
    };
  }, [allMatches, player]);

  const recentMatches = fullMatches.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* This-week pulse */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="sheen flex items-end justify-between gap-4 rounded-2xl border border-border bg-card/60 px-5 py-4 backdrop-blur-md"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            This week
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="gradient-text text-display text-4xl">{stats.thisWeek}</span>
            <span className="text-sm font-medium text-muted-foreground">matches played</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Win rate
          </p>
          <p className="text-display mt-1 text-2xl text-amber-500">
            {stats.thisWeekWinRate !== null ? stats.thisWeekWinRate : "-"}
            {stats.thisWeekWinRate !== null && (
              <span className="text-sm font-medium text-muted-foreground">%</span>
            )}
          </p>
        </div>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          onClick={() => setExpandedCard(expandedCard === "matches" ? null : "matches")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Swords}
            label="Total Matches"
            value={stats.total}
            sub={`${stats.wins} wins`}
            color="var(--primary)"
            delay={0.05}
            expandable
            expanded={expandedCard === "matches"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "elo" ? null : "elo")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={TrendingUp}
            label="Overall ELO"
            value={stats.elo}
            sub="rating"
            color="var(--accent)"
            delay={0.1}
            expandable
            expanded={expandedCard === "elo"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "winrate" ? null : "winrate")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Target}
            label="Win Rate"
            value={`${stats.winRate}%`}
            sub={`${stats.total} played`}
            color="var(--chart-4)"
            delay={0.15}
            expandable
            expanded={expandedCard === "winrate"}
          />
        </button>
        <button
          onClick={() => setExpandedCard(expandedCard === "streak" ? null : "streak")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Flame}
            label="Recent Form"
            value={
              stats.streak === "No matches" ? (
                "—"
              ) : (
                <span className="mx-auto flex max-w-[164px] flex-wrap justify-center gap-1">
                  {stats.streak.split(" ").map((r, i) => (
                    <span
                      key={i}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${
                        r === "W"
                          ? "bg-primary text-primary-foreground"
                          : "bg-rose-500 text-white"
                      }`}
                    >
                      {r}
                    </span>
                  ))}
                </span>
              )
            }
            color="var(--secondary)"
            delay={0.2}
            expandable
            expanded={expandedCard === "streak"}
          />
        </button>
      </div>

      {/* Expandable Breakdown Cards */}
      {expandedCard && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm"
        >
          <div className="space-y-3">
            {/* Friendly Row */}
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Friendly Matches</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Sigma}
                label="Total"
                value={expandedCard === "matches" ? stats.friendly.total : expandedCard === "elo" ? stats.elo : expandedCard === "winrate" ? `${stats.friendly.total ? Math.round((stats.friendly.wins / stats.friendly.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendly.form : stats.friendly.wins}
                sub={expandedCard === "matches" ? `${stats.friendly.wins} wins` : expandedCard === "elo" ? "overall" : expandedCard === "streak" ? "last 10" : "overall"}
                color="var(--primary)"
                delay={0.25}
              />
              <StatCard
                icon={User}
                label="Singles"
                value={expandedCard === "matches" ? stats.friendlySingles.total : expandedCard === "elo" ? stats.singlesElo : expandedCard === "winrate" ? `${stats.friendlySingles.total ? Math.round((stats.friendlySingles.wins / stats.friendlySingles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlySingles.form : stats.friendlySingles.wins}
                sub={expandedCard === "matches" ? `${stats.friendlySingles.wins} wins` : expandedCard === "streak" ? "last 10" : "singles"}
                color="var(--chart-1)"
                delay={0.26}
              />
              <StatCard
                icon={Users}
                label="Doubles"
                value={expandedCard === "matches" ? stats.friendlyDoubles.total : expandedCard === "elo" ? stats.doublesElo : expandedCard === "winrate" ? `${stats.friendlyDoubles.total ? Math.round((stats.friendlyDoubles.wins / stats.friendlyDoubles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlyDoubles.form : stats.friendlyDoubles.wins}
                sub={expandedCard === "matches" ? `${stats.friendlyDoubles.wins} wins` : expandedCard === "streak" ? "last 10" : "doubles"}
                color="var(--chart-2)"
                delay={0.27}
              />
              <StatCard
                icon={UserPlus}
                label="Mixed"
                value={expandedCard === "matches" ? stats.friendlyMixed.total : expandedCard === "elo" ? stats.mixedElo : expandedCard === "winrate" ? `${stats.friendlyMixed.total ? Math.round((stats.friendlyMixed.wins / stats.friendlyMixed.total) * 100) : 0}%` : expandedCard === "streak" ? stats.friendlyMixed.form : stats.friendlyMixed.wins}
                sub={expandedCard === "matches" ? `${stats.friendlyMixed.wins} wins` : expandedCard === "streak" ? "last 10" : "mixed"}
                color="var(--chart-3)"
                delay={0.28}
              />
            </div>

            {/* Tournament Row */}
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">Tournament Matches</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Sigma}
                label="Total"
                value={expandedCard === "matches" ? stats.tournament.total : expandedCard === "elo" ? stats.tournamentElo : expandedCard === "winrate" ? `${stats.tournament.total ? Math.round((stats.tournament.wins / stats.tournament.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournament.form : stats.tournament.wins}
                sub={expandedCard === "matches" ? `${stats.tournament.wins} wins` : expandedCard === "streak" ? "last 10" : "overall"}
                color="var(--accent)"
                delay={0.29}
              />
              <StatCard
                icon={User}
                label="Singles"
                value={expandedCard === "matches" ? stats.tournamentSingles.total : expandedCard === "elo" ? player?.tournament_singles_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentSingles.total ? Math.round((stats.tournamentSingles.wins / stats.tournamentSingles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentSingles.form : stats.tournamentSingles.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentSingles.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "singles"}
                color="var(--chart-4)"
                delay={0.3}
              />
              <StatCard
                icon={Users}
                label="Doubles"
                value={expandedCard === "matches" ? stats.tournamentDoubles.total : expandedCard === "elo" ? player?.tournament_doubles_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentDoubles.total ? Math.round((stats.tournamentDoubles.wins / stats.tournamentDoubles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentDoubles.form : stats.tournamentDoubles.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentDoubles.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "doubles"}
                color="var(--chart-5)"
                delay={0.31}
              />
              <StatCard
                icon={UserPlus}
                label="Mixed"
                value={expandedCard === "matches" ? stats.tournamentMixed.total : expandedCard === "elo" ? player?.tournament_mixed_elo || "N/A" : expandedCard === "winrate" ? `${stats.tournamentMixed.total ? Math.round((stats.tournamentMixed.wins / stats.tournamentMixed.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentMixed.form : stats.tournamentMixed.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentMixed.wins} wins` : expandedCard === "elo" ? "rating" : expandedCard === "streak" ? "last 10" : "mixed"}
                color="var(--chart-6)"
                delay={0.32}
              />
            </div>

            {/* Close Button at the bottom */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setExpandedCard(null)}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors bg-slate-100 dark:bg-slate-800/80 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <ChevronUp className="w-4 h-4" />
                Close Details
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="sheen rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">Recent Matches</h2>
            </div>
            <Link
              href="/personal/stats"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary transition-all hover:gap-1.5"
            >
              View stats <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {recentMatches.map((m) => (
              <FeedMatchCard key={m.id} match={m} currentUser={currentUser} isKudosed={false} kudosCount={0} />
            ))}
          </div>
        </motion.div>
      )}

      {matches.length === 0 && (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-8 text-center">
          <Trophy className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-semibold">No tournament matches yet</p>
        </div>
      )}
    </div>
  );
}

function MatchesSection({ matches, fullMatches, formatTab, setFormatTab, currentUser }: { matches: CareerMatch[]; fullMatches: any[]; formatTab: FormatTab; setFormatTab: (tab: FormatTab) => void; currentUser: any }) {
  const filtered = fullMatches.filter((m) => {
    let group = "Mixed Doubles";
    if (m.category === "MS" || m.category === "WS") group = "Singles";
    if (m.category === "MD" || m.category === "WD") group = "Doubles";
    return group === formatTab;
  });

  const stats = useMemo(() => {
    const singles = matches.filter((m) => m.group === "Singles");
    const doubles = matches.filter((m) => m.group === "Doubles");
    const mixedDoubles = matches.filter((m) => m.group === "Mixed Doubles");

    const calcWinRate = (arr: CareerMatch[]) => {
      const wins = arr.filter((m) => m.won === true).length;
      const total = arr.filter((m) => m.won !== null).length;
      return total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
    };

    return {
      "Singles": { count: singles.length, winRate: calcWinRate(singles), icon: Swords, color: "blue", label: "Singles" },
      "Doubles": { count: doubles.length, winRate: calcWinRate(doubles), icon: Users, color: "green", label: "Doubles" },
      "Mixed Doubles": { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles), icon: Trophy, color: "amber", label: "Mixed" },
    };
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(["Singles", "Doubles", "Mixed Doubles"] as FormatTab[]).map((tab) => {
          const s = stats[tab];
          const Icon = s.icon;
          const isSelected = formatTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => setFormatTab(tab)}
              className={`text-left transition-all bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border p-4 ${
                isSelected 
                  ? "border-amber-400 dark:border-amber-500 ring-1 ring-amber-400 dark:ring-amber-500 scale-[1.02]" 
                  : "border-slate-100 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${
                s.color === "blue" ? "text-blue-500" : s.color === "green" ? "text-green-500" : "text-amber-500"
              }`} />
              <div className="text-sm font-black text-slate-800 dark:text-slate-100">{s.count}</div>
              <div className="text-[10px] font-bold text-muted-foreground">{s.label}</div>
              <div className={`text-xs font-bold mt-1 ${
                s.color === "blue" ? "text-blue-600 dark:text-blue-400" : s.color === "green" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              }`}>{s.winRate}% win</div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((m) => <FeedMatchCard key={m.id} match={m} currentUser={currentUser} isKudosed={false} kudosCount={0} />)
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground italic bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            No {formatTab.toLowerCase()} tournament matches yet
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthSection({ matches }: { matches: CareerMatch[] }) {
  const monthlyData = useMemo(() => {
    const data: { [key: string]: { wins: number; losses: number } } = {};
    matches.forEach((m) => {
      if (!m.scored_at) return;
      const date = new Date(m.scored_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!data[key]) data[key] = { wins: 0, losses: 0 };
      if (m.won === true) data[key].wins++;
      else if (m.won === false) data[key].losses++;
    });
    return Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, stats]) => ({ month, ...stats }));
  }, [matches]);

  const chartData = useMemo(
    () =>
      monthlyData.map((d) => ({
        month: new Date(d.month + "-01").toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        wins: d.wins,
        losses: d.losses,
      })),
    [monthlyData]
  );

  return (
    <div className="space-y-5">
      {chartData.length > 0 ? (
        <>
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-black text-slate-800 dark:text-slate-100">Monthly Performance</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} minTickGap={30} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                  <Tooltip
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="bg-slate-900/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-sm">
                          <p className="text-xs text-muted-foreground font-medium mb-1">{payload[0].payload.month}</p>
                          <p className="text-sm font-black text-green-400">Wins: {payload[0].payload.wins}</p>
                          <p className="text-sm font-black text-rose-400">Losses: {payload[0].payload.losses}</p>
                        </div>
                      ) : null
                    }
                    cursor={{ stroke: "#475569", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wins"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#1e293b", stroke: "#22c55e", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    name="Wins"
                  />
                  <Line
                    type="monotone"
                    dataKey="losses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#1e293b", stroke: "#ef4444", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    name="Losses"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border border-green-200 dark:border-green-800/30">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-xs font-bold text-muted-foreground uppercase">Best Month</div>
              <div className="text-lg font-black text-green-600 dark:text-green-400 mt-1">
                {Math.max(0, ...monthlyData.map((m) => m.wins))} wins
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2" />
              <div className="text-xs font-bold text-muted-foreground uppercase">Current Trend</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                {chartData.length > 0 ? `${chartData[chartData.length - 1].wins}W-${chartData[chartData.length - 1].losses}L` : "—"}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-8 text-center">
          <TrendingUp className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-semibold">No data to show growth yet</p>
        </div>
      )}
    </div>
  );
}

function StatsSection({ matches, motionSummary, motionMatches, workRate, sensorAnalytics }: { matches: CareerMatch[]; motionSummary: any; motionMatches: MotionMatch[]; workRate: number; sensorAnalytics: any[] }) {
  const [subTab, setSubTab] = useState<"Match Stats" | "Phone Sensors" | "Watch Data">("Match Stats");
  const { healthData } = useHealthData(matches.map(m => m.id));

  const stats = useMemo(() => {
    const singles = matches.filter((m) => m.group === "Singles");
    const doubles = matches.filter((m) => m.group === "Doubles");
    const mixedDoubles = matches.filter((m) => m.group === "Mixed Doubles");

    const calcWinRate = (arr: CareerMatch[]) => {
      const wins = arr.filter((m) => m.won === true).length;
      const total = arr.filter((m) => m.won !== null).length;
      return total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    };

    return {
      singles: { count: singles.length, winRate: calcWinRate(singles) },
      doubles: { count: doubles.length, winRate: calcWinRate(doubles) },
      mixedDoubles: { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles) },
    };
  }, [matches]);

  const overallSensors = useMemo(() => {
    if (!sensorAnalytics.length) return null;
    const totalSwings = sensorAnalytics.reduce((s, a) => s + a.totalSwings, 0);
    const smashCount = sensorAnalytics.reduce((s, a) => s + a.smashCount, 0);
    const clearCount = sensorAnalytics.reduce((s, a) => s + a.clearCount, 0);
    const driveCount = sensorAnalytics.reduce((s, a) => s + a.driveCount, 0);
    const netShotCount = sensorAnalytics.reduce((s, a) => s + a.netShotCount, 0);
    const avgFatigue = sensorAnalytics.reduce((s, a) => s + a.fatigueIndex, 0) / sensorAnalytics.length;
    const lateralPct = sensorAnalytics.reduce((s, a) => s + a.lateralPct, 0) / sensorAnalytics.length;
    const forwardBackPct = sensorAnalytics.reduce((s, a) => s + a.forwardBackPct, 0) / sensorAnalytics.length;
    
    return { totalSwings, smashCount, clearCount, driveCount, netShotCount, avgFatigue, lateralPct, forwardBackPct };
  }, [sensorAnalytics]);

  const overallHealth = useMemo(() => {
    if (!healthData || !healthData.length) return null;
    const avgHr = healthData.reduce((s, a) => s + a.hrAvg, 0) / healthData.length;
    const maxHr = Math.max(...healthData.map(h => h.hrMax));
    const totalCalories = healthData.reduce((s, a) => s + a.caloriesBurned, 0);
    const avgCalories = totalCalories / healthData.length;
    const totalSteps = healthData.reduce((s, a) => s + a.steps, 0);
    const avgRecovery = healthData.reduce((s, a) => s + a.hrRecovery, 0) / healthData.length;

    return { avgHr, maxHr, totalCalories, avgCalories, totalSteps, avgRecovery };
  }, [healthData]);

  return (
    <div className="space-y-5">
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
        <button
          onClick={() => setSubTab("Match Stats")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            subTab === "Match Stats" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="w-4 h-4 hidden sm:block" /> Match
        </button>
        <button
          onClick={() => setSubTab("Phone Sensors")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            subTab === "Phone Sensors" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ActivitySquare className="w-4 h-4 hidden sm:block" /> Sensors
        </button>
        <button
          onClick={() => setSubTab("Watch Data")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            subTab === "Watch Data" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Watch className="w-4 h-4 hidden sm:block" /> Watch
        </button>
      </div>

      {subTab === "Match Stats" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Singles</div>
              <div className="text-2xl font-black text-blue-500">{stats.singles.winRate}%</div>
              <div className="text-xs text-muted-foreground">{stats.singles.count} matches</div>
            </div>
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Doubles</div>
              <div className="text-2xl font-black text-green-500">{stats.doubles.winRate}%</div>
              <div className="text-xs text-muted-foreground">{stats.doubles.count} matches</div>
            </div>
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Mixed</div>
              <div className="text-2xl font-black text-amber-500">{stats.mixedDoubles.winRate}%</div>
              <div className="text-xs text-muted-foreground">{stats.mixedDoubles.count} matches</div>
            </div>
          </div>
          
          {motionMatches.length > 0 && <MotionAnalyticsPanels motionMatches={motionMatches} />}
        </div>
      )}

      {subTab === "Phone Sensors" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {motionSummary ? (
            <>
              {/* Existing Accelerometer Motion Data */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <ActivitySquare className="w-5 h-5 text-primary" />
                  <h2 className="font-black text-slate-800 dark:text-slate-100">On-Court Motion</h2>
                  <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                    {motionSummary.matchCount} tracked match{motionSummary.matchCount === 1 ? "" : "es"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="text-lg font-black text-slate-800 dark:text-slate-100">{motionSummary.avgMagnitude.toFixed(1)}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Avg Intensity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-lg font-black text-slate-800 dark:text-slate-100">{motionSummary.peakMagnitude.toFixed(1)}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Peak Intensity</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-500" />
                    <div>
                      <div className="text-lg font-black text-slate-800 dark:text-slate-100">{workRate.toFixed(0)}</div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Work-Rate Score</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <MotionStatBar label="Idle" pct={motionSummary.idlePct} color="bg-slate-400" />
                  <MotionStatBar label="Walking" pct={motionSummary.walkingPct} color="bg-blue-400" />
                  <MotionStatBar label="Running" pct={motionSummary.runningPct} color="bg-amber-500" />
                  <MotionStatBar label="Smash Sprint" pct={motionSummary.smashSprintPct} color="bg-rose-500" />
                </div>
              </motion.div>

              {/* New Sensor Analytics Data */}
              {overallSensors && overallSensors.totalSwings > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-black text-slate-800 dark:text-slate-100">Swing & Movement Analysis</h2>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Shot Distribution</div>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        <div className="bg-rose-500" style={{ width: `${(overallSensors.smashCount / overallSensors.totalSwings) * 100}%` }} title="Smash" />
                        <div className="bg-blue-500" style={{ width: `${(overallSensors.clearCount / overallSensors.totalSwings) * 100}%` }} title="Clear" />
                        <div className="bg-amber-500" style={{ width: `${(overallSensors.driveCount / overallSensors.totalSwings) * 100}%` }} title="Drive" />
                        <div className="bg-emerald-500" style={{ width: `${(overallSensors.netShotCount / overallSensors.totalSwings) * 100}%` }} title="Net Shot" />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-muted-foreground">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"/> Smash</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"/> Clear</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/> Drive</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Net</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Fatigue Index</div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{overallSensors.avgFatigue.toFixed(2)}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{overallSensors.avgFatigue < 0.9 ? 'Fading' : overallSensors.avgFatigue > 1.1 ? 'Finishing Strong' : 'Consistent'}</div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Movement Bias</div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{Math.round(overallSensors.lateralPct)}%</div>
                          <div className="text-[10px] text-muted-foreground font-medium">Lateral</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-8 text-center">
              <Footprints className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">
                No motion data yet — enable "Track Motion" while umpiring to capture it.
              </p>
            </div>
          )}
        </div>
      )}

      {subTab === "Watch Data" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 text-center">
            {overallHealth ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-bold text-muted-foreground uppercase">Average Heart Rate</div>
                  <div className="text-3xl font-black text-red-500">{Math.round(overallHealth.avgHr)} <span className="text-sm font-normal text-muted-foreground">BPM</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Max HR</div>
                    <div className="text-xl font-bold">{Math.round(overallHealth.maxHr)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Recovery HR</div>
                    <div className="text-xl font-bold">{Math.round(overallHealth.avgRecovery)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Calories</div>
                    <div className="text-xl font-bold text-orange-500">{Math.round(overallHealth.totalCalories)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Steps</div>
                    <div className="text-xl font-bold text-blue-500">{Math.round(overallHealth.totalSteps)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <Watch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="font-bold text-lg">No Watch Data</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Sync your smartwatch via Android Health Connect after a match to view heart rate and calorie data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingSection() {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl shadow-md border border-blue-200 dark:border-blue-800/30 p-6 text-center">
        <Dumbbell className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
        <h2 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-2">Training</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">Training data and progress tracking coming soon</p>
      </div>
    </div>
  );
}

function MeSection({ player }: { player: any }) {
  const { profile, session, refreshProfile, signOut, isMasterAdmin, viewAsRole, setViewAsRole } = useAuth();
  const {
    isAdmin,
    savedAccounts,
    switchAccount,
  } = useNavigationAuth();
  
  const handleInvite = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "IISc Shuttlers",
        text: "Join the IISc Shuttlers community!",
        url: window.location.origin,
      });
    } else {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success("Link copied to clipboard!");
    }
  };
  
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");
  
  // Avatar Zoom State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { theme, toggleTheme } = useTheme();
  const { setMode } = useAppMode();
  const [signOutDialog, setSignOutDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const currentStatus = (profile as any)?.status || "looking";

  const updateStatus = async (newStatus: string) => {
    if (!profile?.id || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase.from("players").update({ status: newStatus }).eq("id", profile.id);
      if (error) throw error;
      if (newStatus === "playing" && session?.user?.id) {
        const now = new Date();
        await supabase.from("court_visits").insert({ user_id: session.user.id, visited_at: now.toISOString(), day_of_week: now.getDay(), hour: now.getHours() });
      }
      
      // Notify buddies
      if (newStatus === "playing" || newStatus === "looking") {
        supabase.functions.invoke("notify-social", {
          body: {
            type: "status_update",
            from_player_id: profile.id,
            from_name: profile.full_name || "A buddy",
            new_status: newStatus,
          },
        }).catch((err) => console.error("Failed to notify buddies of status update:", err));
      }

      await refreshProfile();
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const profileItems = [
    {
      icon: User,
      label: "Edit Profile",
      description: "Update your name, avatar, and bio",
      href: "/profile/setup",
    },
    {
      icon: Lock,
      label: "Change Password",
      description: "Update your account password",
      href: "/profile/password",
    },
    {
      icon: Trash2,
      label: "Delete Account",
      description: "Permanently delete your account",
      href: "/delete-account",
      danger: true,
    },
  ];

  const settingsItems = [
    {
      icon: ArrowLeft,
      label: "Switch to Club Mode",
      description: "Return to the main club dashboard",
      onClick: () => {
        setMode("club");
        setLocation("/");
      },
      primaryIcon: true,
    },
    {
      icon: UserPlus,
      label: "Add Account",
      description: "Log in to an additional account",
      href: "/join?add_account=true",
    },
    {
      icon: UserPlus,
      label: "Invite Friends",
      description: "Share the app with others",
      onClick: handleInvite,
      primaryIcon: true,
    },
    ...(isAdmin ? [{
      icon: Zap,
      label: "Site Admin",
      description: "Access the master admin dashboard",
      href: "/admin",
      adminIcon: true,
    }] : []),
    {
      icon: Shield,
      label: "Privacy Policy",
      description: "Read our privacy policy",
      href: "/privacy",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Profile Header */}
      <div className="mb-6 flex items-center gap-4 bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-6">
        <button 
          onClick={() => {
            setZoomLevel(1);
            setIsAvatarModalOpen(true);
          }}
          className="relative rounded-full overflow-hidden focus:outline-none focus:ring-4 focus:ring-primary/20 transition-transform active:scale-95"
        >
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <ZoomIn className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground truncate">
            {profile?.full_name || "Your Profile"}
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground truncate">
            {profile?.email || ""}
          </p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
            Member since{" "}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "recently"}
          </p>
        </div>
      </div>

      {/* Tabs Toggle */}
      <div className="flex p-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            activeTab === "profile" 
              ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
            activeTab === "settings" 
              ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Settings
        </button>
      </div>

      {activeTab === "profile" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Status Selector */}
          <div className="mb-6 bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Current Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_CONFIG.map(({ id, short, dot, active: activeClass }) => {
                const active = currentStatus === id;
                return (
                  <button
                    key={id}
                    disabled={updatingStatus}
                    onClick={() => updateStatus(id)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all",
                      active
                        ? activeClass
                        : "bg-slate-50 dark:bg-slate-800 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", active ? dot : "bg-slate-300 dark:bg-slate-600")} />
                    {short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Appearance Toggle */}
          <div className="mb-6 bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" /> Appearance
            </h3>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex gap-1">
              <button onClick={() => { if (theme === "dark") toggleTheme?.(); }} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all", theme === "light" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300")}>
                <Sun className="w-4 h-4" /> Light
              </button>
              <button onClick={() => { if (theme === "light") toggleTheme?.(); }} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all", theme === "dark" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300")}>
                <Moon className="w-4 h-4" /> Dark
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            {profileItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <div className="flex-shrink-0">
                    <Icon className={cn("w-5 h-5", item.danger ? "text-rose-500" : "text-muted-foreground group-hover:text-primary")} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("font-semibold", item.danger ? "text-rose-600 dark:text-rose-400" : "text-foreground dark:text-foreground")}>
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.label} href={item.href}>{content}</Link>
              ) : (
                <button key={item.label} onClick={(item as any).onClick} className="w-full text-left">{content}</button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* View As Role */}
          {isMasterAdmin && (
            <div className="mb-6 bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700/50 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">View As Role</h3>
              </div>
              <div className="p-3">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                  <button onClick={() => setViewAsRole(null)} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", !viewAsRole ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Master</button>
                  <button onClick={() => setViewAsRole('admin')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'admin' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Admin</button>
                  <button onClick={() => setViewAsRole('umpire')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'umpire' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>Umpire</button>
                  <button onClick={() => setViewAsRole('player')} className={cn("flex-1 text-[11px] font-bold py-2 rounded-lg transition-all", viewAsRole === 'player' ? "bg-white dark:bg-slate-700 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>User</button>
                </div>
              </div>
            </div>
          )}
          {/* Switch Accounts section */}
          {savedAccounts.length > 0 && (
            <div className="mb-6 bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700/50 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Switch Account</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {savedAccounts.map((acc) => (
                  <button 
                    key={acc.id} 
                    onClick={async () => { await switchAccount(acc); }}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-foreground">{acc.name}</span>
                    <span className="text-xs text-muted-foreground">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const content = (
                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/80 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                  <div className="flex-shrink-0">
                    <Icon className={cn("w-5 h-5", item.primaryIcon ? "text-primary" : item.adminIcon ? "text-violet-500" : "text-muted-foreground group-hover:text-primary")} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("font-semibold text-foreground dark:text-foreground", item.adminIcon && "text-violet-600 dark:text-violet-400")}>
                      {item.label}
                    </h3>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              );

              return item.href ? (
                <Link key={item.label} href={item.href}>{content}</Link>
              ) : (
                <button key={item.label} onClick={(item as any).onClick} className="w-full text-left">{content}</button>
              );
            })}
          </div>

          {/* Sign Out Button */}
          <div className="border-t border-slate-200 dark:border-slate-700/50 pt-6 mb-6">
            <Button
              onClick={() => setSignOutDialog(true)}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 py-6 rounded-xl transition-colors font-bold"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation */}
      <ConfirmDialog
        open={signOutDialog}
        title="Sign Out"
        description="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        confirmVariant="danger"
        onConfirm={handleSignOut}
        onCancel={() => setSignOutDialog(false)}
      />

      <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
        <DialogContent className="max-w-md w-[90vw] p-0 overflow-hidden bg-black/95 border-slate-800 sm:rounded-2xl rounded-2xl flex flex-col h-[70vh] sm:h-[80vh]">
          {/* Header Controls */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex gap-2">
              <button 
                onClick={() => setZoomLevel(s => Math.min(s + 0.5, 4))}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(s => Math.max(s - 0.5, 1))}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </div>
            <button 
              onClick={() => setIsAvatarModalOpen(false)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors active:scale-95"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Zoomable Image Container */}
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-auto touch-pan-x touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="min-w-full min-h-full flex items-center justify-center p-4">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || "Avatar"} 
                  className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-200 origin-center"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
              ) : (
                <div 
                  className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-primary to-teal-500 flex items-center justify-center text-white font-bold text-6xl shadow-xl transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {(profile?.full_name || "U")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getTabIcon(tab: MainTab) {
  switch (tab) {
    case "Home":
      return <Home className="w-4 h-4" />;
    case "Matches":
      return <Swords className="w-4 h-4" />;
    case "Growth":
      return <TrendingUp className="w-4 h-4" />;
    case "Stats":
      return <BarChart3 className="w-4 h-4" />;
    case "Training":
      return <Dumbbell className="w-4 h-4" />;
    case "Me":
      return <User className="w-4 h-4" />;
    default:
      return null;
  }
}

export default function PlayerCareerPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("Home");
  const [formatTab, setFormatTab] = useState<FormatTab>("Singles");

  useEffect(() => {
    if (!id) return;
    fetchPlayer(id).then(setPlayer).catch(() => {});
  }, [id]);


  const { data, isLoading } = usePlayerCareer(id);
  const { matches: fullMatches, loading: fullMatchesLoading } = usePlayerMatches(id);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const matches = data?.matches ?? [];
  const motionSummary = data?.motion ?? null;
  const motionMatches = data?.motionMatches ?? [];
  const sensorAnalytics = data?.sensorAnalytics ?? [];
  const workRate = motionSummary ? motionSummary.runningPct + motionSummary.smashSprintPct * 2 : 0;

  if (isLoading || fullMatchesLoading || !player) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628] pb-32 lg:pb-0 lg:flex">
      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 py-6 px-4">
        {/* Logo / Brand & Actions */}
        <div className="flex flex-col gap-5 px-2 mb-8">
          <Link href="/">
            <a className="flex items-center gap-3 group w-full cursor-pointer">
              <img
                src="/iisc-logo.png"
                alt="IISc Logo"
                className="h-9 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-[14px] tracking-tight text-foreground dark:text-foreground hidden xl:block whitespace-nowrap text-left">
                IISc Badminton Club
              </span>
            </a>
          </Link>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
              className="flex-1 flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-muted-foreground dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors border border-transparent dark:border-slate-800"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs font-semibold">Search...</span>
            </button>
          </div>
        </div>
        
        {/* Nav links */}
        <nav className="flex flex-col gap-1 flex-1">
          {MAIN_TABS.filter(tab => tab !== "Me").map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 w-full text-left",
                  active
                    ? "text-primary dark:text-primary bg-primary/10 dark:bg-primary/30"
                    : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary/15 dark:bg-primary/40 rounded-xl"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
                  />
                )}
                <span className={cn("relative z-10 flex items-center gap-3", active && "text-primary dark:text-primary")}>
                  {getTabIcon(tab)}
                  <span>{tab}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-2 border-t border-border pt-4 mt-4">
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all w-full"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-5 h-5" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5" />
                  Dark Mode
                </>
              )}
            </button>
          )}

          {profile?.id && (
            <Link href={`/player/${profile.id}/career`}>
              <a className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full hover:bg-slate-100 dark:hover:bg-slate-800/60 group mt-1 cursor-pointer">
                <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors text-left">
                    {profile.full_name?.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate text-left">{profile.email}</span>
                </div>
              </a>
            </Link>
          )}
          
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-500/80 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all w-full mt-1"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 lg:pt-8 pb-8">
        {/* Hero */}
        <div className="relative overflow-hidden border border-border px-5 pt-8 pb-7 lg:px-8 lg:pt-10 mb-6 bg-card/40 rounded-2xl">
          <div className="grid-texture absolute inset-0 opacity-60" />
          <div className="orb orb-volt absolute -top-24 -right-16 h-72 w-72" />
          <div className="orb orb-cyan absolute -bottom-16 left-1/4 h-44 w-44" />

          <div className="relative z-10 mx-auto max-w-4xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {player?.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.full_name}
                    className="h-16 w-16 rounded-full border-2 border-primary/40 object-cover"
                  />
                ) : (
                  <div className="gradient-bg flex h-16 w-16 items-center justify-center rounded-full text-2xl font-extrabold text-primary-foreground">
                    {player?.full_name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{(() => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; return "Good evening"; })()},</p>
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 truncate text-3xl font-extrabold leading-none tracking-tight lg:text-4xl text-slate-800 dark:text-slate-100"
                  >
                    {player?.full_name?.split(" ")[0]}
                  </motion.h1>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold capitalize text-primary">
                      {player?.playing_level ?? "Player"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                      <Flame className="h-3.5 w-3.5" />
                      {player?.recent_form || "LLWLL"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        {activeTab === "Home" && <HomeSection player={player} matches={matches} fullMatches={fullMatches} currentUser={profile} />}
        {activeTab === "Matches" && <MatchesSection matches={matches} fullMatches={fullMatches} formatTab={formatTab} setFormatTab={setFormatTab} currentUser={profile} />}
        {activeTab === "Growth" && <GrowthSection matches={matches} />}
        {activeTab === "Stats" && <StatsSection matches={matches} motionSummary={motionSummary} motionMatches={motionMatches} workRate={workRate} sensorAnalytics={sensorAnalytics} />}
        {activeTab === "Training" && <TrainingSection />}
        {activeTab === "Me" && <MeSection player={player} />}
      </div>

      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 z-[999] lg:hidden bg-white dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
        <div className="w-full px-0">
          <div className="grid grid-cols-6 gap-0 h-16">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-col items-center justify-center py-2 px-0.5 transition ${
                  activeTab === tab
                    ? "bg-primary/20 text-primary border-t-2 border-primary"
                    : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 border-t-2 border-transparent"
                }`}
              >
                {getTabIcon(tab)}
                <span className="text-[9px] font-bold mt-0.5 leading-tight">{tab}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
