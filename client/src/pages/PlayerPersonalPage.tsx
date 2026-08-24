import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useLocation, Redirect } from "wouter";
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
  Watch,
  ChevronDown,
  RefreshCw,
  HelpCircle,
  Route,
  Bell
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";

import { usePlayerPersonal, type PersonalMatch, type MotionMatch } from "@/hooks/usePlayerPersonal";
import { useHealthData } from "@/hooks/useHealthData";
import { useSleepData } from "@/hooks/useSleepData";
import { useTrainingLoad } from "@/hooks/useTrainingLoad";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useClubBenchmarks } from "@/hooks/useClubBenchmarks";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { SelfMotionTracker } from "@/components/player/SelfMotionTracker";
import { RallyBreakdown } from "@/components/player/RallyBreakdown";
import { PathTracingEntry } from "@/components/pathTracing/PathTracingEntry";
import type { MatchSource } from "@/services/pathTracingService";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { shareMatch } from "@/lib/shareMatch";
import { MatchAnalyticsSection } from "@/components/feed/MatchAnalyticsSection";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { fetchPlayer } from "@/services/playerService";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingScreen } from "@/components/player-profile/PlayerProfileWidgets";
import { Capacitor } from "@capacitor/core";
import HealthConnect from "@/lib/healthConnect";
import { StatCard } from "@/components/personal/StatCard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AcousticTensionAnalyzer } from "@/components/player/AcousticTensionAnalyzer";
import { ShadowDrillEngine } from "@/components/player/ShadowDrillEngine";
import { LineCallChallenge } from "@/components/player/LineCallChallenge";
import { AutoHighlightsRecorder } from "@/components/player/AutoHighlightsRecorder";
import { ARReplayViewer } from "@/components/player/ARReplayViewer";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { useAppMode } from "@/contexts/AppModeContext";

const MAIN_TABS = ["Home", "Matches", "Stats", "Training", "Me"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const FORMAT_TABS = ["Singles", "Doubles", "Mixed Doubles"] as const;
type FormatTab = (typeof FORMAT_TABS)[number];

const STATUS_CONFIG = [
  { id: "looking", short: "Available", dot: "bg-primary", active: "bg-primary/20 text-primary dark:text-primary/70 ring-1 ring-primary/40" },
  { id: "playing", short: "Playing", dot: "bg-[var(--status-playing)]", active: "bg-[var(--status-playing)]/20 text-[var(--status-playing)] dark:text-[var(--status-playing)] ring-1 ring-[var(--status-playing)]/40" },
  { id: "resting", short: "Resting", dot: "bg-[var(--status-resting)]", active: "bg-[var(--status-resting)]/20 text-[var(--status-resting)] dark:text-[var(--status-resting)] ring-1 ring-[var(--status-resting)]/40" },
  { id: "injured", short: "Injured", dot: "bg-[var(--status-injured)]", active: "bg-[var(--status-injured)]/20 text-[var(--status-injured)] dark:text-[var(--status-injured)] ring-1 ring-[var(--status-injured)]/40" },
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
          <RechartsTooltip
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

function ComparisonRow({ label, a, b, aLabel, bLabel, suffix = "%" }: { label: string; a: number; b: number; aLabel: string; bLabel: string; suffix?: string }) {
  const max = Math.max(a, b, 1);
  return (
    <div>
      <div className="text-xs font-bold text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="w-10 text-right text-[10px] font-black text-[var(--series-a)]">{aLabel}</div>
        <div className="flex-1 flex items-center gap-0.5">
          <div className="flex-1 flex justify-end">
            <div className="h-2.5 rounded-l-full bg-[var(--series-a)]" style={{ width: `${(a / max) * 100}%` }} />
          </div>
          <div className="flex-1">
            <div className="h-2.5 rounded-r-full bg-[var(--series-b)]" style={{ width: `${(b / max) * 100}%` }} />
          </div>
        </div>
        <div className="w-10 text-[10px] font-black text-[var(--series-b)]">{bLabel}</div>
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] font-bold text-[var(--series-a)]">{a.toFixed(0)}{suffix}</span>
        <span className="text-[10px] font-bold text-[var(--series-b)]">{b.toFixed(0)}{suffix}</span>
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
        <div className="bg-gradient-to-br from-[var(--series-b)]/10 to-amber-500/10 rounded-2xl shadow-md border border-[var(--series-b)] dark:border-[var(--series-b)]/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-[var(--series-b)]" />
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

function HomeSection({ player, matches, fullMatches, currentUser }: { player: any; matches: PersonalMatch[]; fullMatches: any[]; currentUser: any }) {
  const [, setLocation] = useLocation();
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.scored_at || b.started_at || 0).getTime() - new Date(a.scored_at || a.started_at || 0).getTime()
  );
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { matches: allMatches } = usePlayerMatches(player?.id);

  const stats = useMemo(() => {
    const isWinner = (m: any) => {
      const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
      if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    };

    const isStraightSetWin = (m: any) => {
      if (!isWinner(m)) return false;
      const scoreStr = m.match_score || m.score || "";
      if (!scoreStr) return false;
      let lostASet = false;
      let playedSets = 0;
      const setStrs = scoreStr.split(/,| /).map((s: string) => s.trim()).filter(Boolean);
      for (const setStr of setStrs) {
        const parts = setStr.split("-");
        if (parts.length === 2) {
           const s1 = parseInt(parts[0], 10);
           const s2 = parseInt(parts[1], 10);
           if (isNaN(s1) || isNaN(s2)) continue;
           playedSets++;
           const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
           const team1WonSet = s1 > s2;
           if (!(isTeam1 ? team1WonSet : !team1WonSet)) {
             lostASet = true;
             break;
           }
        }
      }
      return !lostASet && playedSets > 0;
    };

    const allMatchesArr = allMatches || [];
    
    const friendlyMatches = allMatchesArr.filter((m) => m.is_friendly !== false);
    const tournamentMatches = allMatchesArr.filter((m) => m.is_friendly === false);

    const total = allMatchesArr.length;
    const wins = allMatchesArr.filter(isWinner).length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;

    const getForm = (arr: any[]) => {
      const recent = arr.slice(0, 10).map(m => isWinner(m) ? "W" : "L").reverse();
      return recent.length > 0 ? recent.join(" ") : "No matches";
    };

    const streak = getForm(allMatchesArr);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const thisWeekMatches = allMatchesArr.filter((m) => ((m as any).date || m.created_at || "") >= weekAgo);
    const thisWeek = thisWeekMatches.length;
    const thisWeekWins = thisWeekMatches.filter(isWinner).length;
    const thisWeekWinRate = thisWeek > 0 ? Math.round((thisWeekWins / thisWeek) * 100) : null;

    const friendlyWins = friendlyMatches.filter(isWinner).length;
    const tournamentWins = tournamentMatches.filter(isWinner).length;

    const isSingles = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return cat.includes("singles") || cat === "ms" || cat === "ws";
    };
    const isDoubles = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return (cat.includes("doubles") && !cat.includes("mixed")) || cat === "md" || cat === "wd";
    };
    const isMixed = (c?: string) => {
      const cat = (c || "").toLowerCase();
      return cat.includes("mixed") || cat === "xd";
    };

    const friendlySingles = friendlyMatches.filter((m) => isSingles(m.category));
    const friendlyDoubles = friendlyMatches.filter((m) => isDoubles(m.category));
    const friendlyMixed = friendlyMatches.filter((m) => isMixed(m.category));
    
    const tournamentSingles = allMatchesArr.filter((m) => isSingles(m.category));
    const tournamentDoubles = allMatchesArr.filter((m) => isDoubles(m.category));
    const tournamentMixed = allMatchesArr.filter((m) => isMixed(m.category));

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
      straightSets: allMatchesArr.filter(isStraightSetWin).length,
      friendly: { total: friendlyMatches.length, wins: friendlyWins, form: getForm(friendlyMatches) },
      tournament: { total: tournamentMatches.length, wins: tournamentWins, form: getForm(tournamentMatches), straightSets: tournamentMatches.filter(isStraightSetWin).length },
      friendlySingles: { total: friendlySingles.length, wins: friendlySingles.filter(isWinner).length, form: getForm(friendlySingles) },
      friendlyDoubles: { total: friendlyDoubles.length, wins: friendlyDoubles.filter(isWinner).length, form: getForm(friendlyDoubles) },
      friendlyMixed: { total: friendlyMixed.length, wins: friendlyMixed.filter(isWinner).length, form: getForm(friendlyMixed) },
      tournamentSingles: { total: tournamentSingles.length, wins: tournamentSingles.filter(isWinner).length, form: getForm(tournamentSingles), straightSets: tournamentSingles.filter(isStraightSetWin).length },
      tournamentDoubles: { total: tournamentDoubles.length, wins: tournamentDoubles.filter(isWinner).length, form: getForm(tournamentDoubles), straightSets: tournamentDoubles.filter(isStraightSetWin).length },
      tournamentMixed: { total: tournamentMixed.length, wins: tournamentMixed.filter(isWinner).length, form: getForm(tournamentMixed), straightSets: tournamentMixed.filter(isStraightSetWin).length },
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
          onClick={() => setExpandedCard(expandedCard === "straightSets" ? null : "straightSets")}
          className="cursor-pointer transition-transform hover:scale-105 relative group h-full w-full text-left"
        >
          <StatCard
            icon={Zap}
            label="Straight Sets"
            value={stats.straightSets}
            sub="2-0 wins"
            color="var(--accent)"
            delay={0.1}
            expandable
            expanded={expandedCard === "straightSets"}
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
                          : "bg-[var(--series-b)] text-white"
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Sigma}
                label="Total"
                value={expandedCard === "matches" ? stats.tournament.total : expandedCard === "straightSets" ? stats.tournament.straightSets : expandedCard === "winrate" ? `${stats.tournament.total ? Math.round((stats.tournament.wins / stats.tournament.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournament.form : stats.tournament.wins}
                sub={expandedCard === "matches" ? `${stats.tournament.wins} wins` : expandedCard === "straightSets" ? "2-0 wins" : expandedCard === "streak" ? "last 10" : "overall"}
                color="var(--accent)"
                delay={0.29}
              />
              <StatCard
                icon={User}
                label="Singles"
                value={expandedCard === "matches" ? stats.tournamentSingles.total : expandedCard === "straightSets" ? stats.tournamentSingles.straightSets : expandedCard === "winrate" ? `${stats.tournamentSingles.total ? Math.round((stats.tournamentSingles.wins / stats.tournamentSingles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentSingles.form : stats.tournamentSingles.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentSingles.wins} wins` : expandedCard === "straightSets" ? "2-0 wins" : expandedCard === "streak" ? "last 10" : "singles"}
                color="var(--chart-4)"
                delay={0.3}
              />
              <StatCard
                icon={Users}
                label="Doubles"
                value={expandedCard === "matches" ? stats.tournamentDoubles.total : expandedCard === "straightSets" ? stats.tournamentDoubles.straightSets : expandedCard === "winrate" ? `${stats.tournamentDoubles.total ? Math.round((stats.tournamentDoubles.wins / stats.tournamentDoubles.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentDoubles.form : stats.tournamentDoubles.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentDoubles.wins} wins` : expandedCard === "straightSets" ? "2-0 wins" : expandedCard === "streak" ? "last 10" : "doubles"}
                color="var(--chart-5)"
                delay={0.31}
              />
              <StatCard
                icon={UserPlus}
                label="Mixed"
                value={expandedCard === "matches" ? stats.tournamentMixed.total : expandedCard === "straightSets" ? stats.tournamentMixed.straightSets : expandedCard === "winrate" ? `${stats.tournamentMixed.total ? Math.round((stats.tournamentMixed.wins / stats.tournamentMixed.total) * 100) : 0}%` : expandedCard === "streak" ? stats.tournamentMixed.form : stats.tournamentMixed.wins}
                sub={expandedCard === "matches" ? `${stats.tournamentMixed.wins} wins` : expandedCard === "straightSets" ? "2-0 wins" : expandedCard === "streak" ? "last 10" : "mixed"}
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
            <button
              onClick={() => setLocation(`/player/${player.id}/personal/stats/match`)}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary transition-all hover:gap-1.5"
            >
              View stats <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {recentMatches.map((m) => (
              <PersonalMatchCardItem key={m.id} match={m} currentUser={currentUser} />
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

function PersonalMatchCardItem({ match, currentUser }: { match: any; currentUser: any }) {
  const [liked, setLiked] = useState<boolean | null>(null);

  const isLikedLocally = liked !== null ? liked : !!localStorage.getItem(`liked_${match.id}`);
  const baseCount = Array.isArray(match.kudos_users) ? match.kudos_users.length : (match.kudos_count || 0);
  const isIncludedInBackend = Array.isArray(match.kudos_users) && currentUser?.id && match.kudos_users.includes(currentUser.id);

  let finalKudosCount = baseCount;
  if (isLikedLocally && !isIncludedInBackend) {
    finalKudosCount += 1;
  } else if (!isLikedLocally && isIncludedInBackend) {
    finalKudosCount = Math.max(0, finalKudosCount - 1);
  }

  const isKudosed = isLikedLocally || isIncludedInBackend;

  const handleKudos = async () => {
    const storageKey = `liked_${match.id}`;
    const isCurrentlyLiked = isKudosed;

    if (!isCurrentlyLiked) {
      localStorage.setItem(storageKey, "1");
      setLiked(true);
      toast.success("Match liked! ❤️");
    } else {
      localStorage.removeItem(storageKey);
      setLiked(false);
      toast.success("Like removed");
    }

    if (currentUser?.id) {
      supabase
        .rpc("toggle_match_kudos", { p_match_id: match.id })
        .then(({ error }) => {
          if (error) console.warn("Failed to sync kudos live:", error);
        });
    }
  };

  return (
    <FeedMatchCard
      match={match}
      currentUser={currentUser}
      isKudosed={isKudosed}
      kudosCount={finalKudosCount}
      onKudos={handleKudos}
      onShare={() => shareMatch(match)}
    />
  );
}

function MatchesSection({ matches, fullMatches, formatTab, setFormatTab, currentUser }: { matches: PersonalMatch[]; fullMatches: any[]; formatTab: FormatTab; setFormatTab: (tab: FormatTab) => void; currentUser: any }) {
  const getGroup = (c?: string) => {
    const cat = (c || "").toUpperCase();
    if (cat === "MS" || cat === "WS" || cat.includes("SINGLES")) return "Singles";
    if (cat === "MD" || cat === "WD" || (cat.includes("DOUBLES") && !cat.includes("MIXED"))) return "Doubles";
    if (cat === "XD" || cat.includes("MIXED")) return "Mixed Doubles";
    return "Singles";
  };

  const isWinner = (m: any) => {
    if (typeof m.won === "boolean") return m.won;
    const pId = currentUser?.id;
    if (!pId) return false;
    const isTeam1 = m.player1_id === pId || m.team1_partner_id === pId || m.player1?.id === pId;
    if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
    const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id || m.winner_id === m.player1?.id;
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  };

  const filtered = fullMatches.filter((m) => getGroup(m.category) === formatTab);

  const stats = useMemo(() => {
    const singles = fullMatches.filter((m) => getGroup(m.category) === "Singles");
    const doubles = fullMatches.filter((m) => getGroup(m.category) === "Doubles");
    const mixedDoubles = fullMatches.filter((m) => getGroup(m.category) === "Mixed Doubles");

    const calcWinRate = (arr: any[]) => {
      if (arr.length === 0) return 0;
      const wins = arr.filter(isWinner).length;
      return ((wins / arr.length) * 100).toFixed(0);
    };

    return {
      "Singles": { count: singles.length, winRate: calcWinRate(singles), icon: Swords, color: "blue", label: "Singles" },
      "Doubles": { count: doubles.length, winRate: calcWinRate(doubles), icon: Users, color: "green", label: "Doubles" },
      "Mixed Doubles": { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles), icon: Trophy, color: "amber", label: "Mixed" },
    };
  }, [fullMatches, currentUser]);

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
                s.color === "blue" ? "text-[var(--series-a)]" : s.color === "green" ? "text-green-500" : "text-amber-500"
              }`} />
              <div className="text-sm font-black text-slate-800 dark:text-slate-100">{s.count}</div>
              <div className="text-[10px] font-bold text-muted-foreground">{s.label}</div>
              <div className={`text-xs font-bold mt-1 ${
                s.color === "blue" ? "text-[var(--series-a)] dark:text-[var(--series-a)]" : s.color === "green" ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
              }`}>{s.winRate}% win</div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((m) => <PersonalMatchCardItem key={m.id} match={m} currentUser={currentUser} />)
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground italic bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700/50">
            No {formatTab.toLowerCase()} tournament matches yet
          </div>
        )}
      </div>
    </div>
  );
}

function StatsSection({ matches, motionSummary, motionMatches, workRate, sensorAnalytics, playerId, isCurrentUser, currentSubTab }: { matches: PersonalMatch[]; motionSummary: any; motionMatches: MotionMatch[]; workRate: number; sensorAnalytics: any[]; playerId?: string; isCurrentUser?: boolean; currentSubTab: "Match Stats" | "Phone" | "Watch Data" | "Rallies" }) {
  const [, setLocation] = useLocation();
  const { confirm } = useConfirm();
  const allMatchIds = useMemo(() => {
    const ids = new Set(matches.map(m => m.id));
    motionMatches.forEach(m => ids.add(m.matchId));
    return Array.from(ids);
  }, [matches, motionMatches]);
  const { healthData, refetch: refetchHealth } = useHealthData(allMatchIds, playerId);
  const { sleepData, refetch: refetchSleep } = useSleepData(playerId);
  const { data: trainingLoad } = useTrainingLoad(playerId);
  const { data: clubBenchmarks } = useClubBenchmarks();
  const [isSelfTracking, setIsSelfTracking] = useState(false);
  const [showWatchInstructions, setShowWatchInstructions] = useState(false);
  const [isSyncingWatch, setIsSyncingWatch] = useState(false);
  const [isSyncingSleep, setIsSyncingSleep] = useState(false);
  const [isHealthConnectEnabled, setIsHealthConnectEnabled] = useState(() => localStorage.getItem("hc_enabled") === "true");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("all");
  const [selectedRallyMatchId, setSelectedRallyMatchId] = useState<string>("");

  const handleDeleteSession = async (matchId: string, matchSource: string) => {
    const ok = await confirm({ title: "Delete Session Data", description: "Are you sure you want to delete all motion and sensor data for this session?", confirmLabel: "Delete", confirmVariant: "danger" });
    if (!ok) return;
    try {
      const { error } = await supabase.rpc("delete_player_match_session", {
        p_match_id: matchId,
        p_match_source: matchSource
      });
      if (error) throw error;
      toast.success("Session data deleted");
      window.location.reload();
    } catch (err: any) {
      toast.error("Failed to delete session: " + err.message);
    }
  };

  const handleDeleteHealthData = async () => {
    if (!playerId) return;
    const ok = await confirm({ title: "Delete Health Data", description: "Delete all your synced heart rate, activity, and sleep data? This can't be undone.", confirmLabel: "Delete", confirmVariant: "danger" });
    if (!ok) return;
    try {
      const [healthRes, sleepRes] = await Promise.all([
        supabase.from("match_health_data").delete().eq("player_id", playerId),
        supabase.from("player_sleep_data").delete().eq("player_id", playerId),
      ]);
      if (healthRes.error || sleepRes.error) {
        console.error("Error deleting health data", healthRes.error, sleepRes.error);
        toast.error("Failed to delete health data");
        return;
      }
      toast.success("Your health and sleep data has been deleted");
      if (refetchHealth) refetchHealth();
      if (refetchSleep) refetchSleep();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete health data");
    }
  };

  const handleSyncSleep = async () => {
    setIsSyncingSleep(true);
    try {
      const platform = Capacitor.getPlatform();
      if (platform !== "android") {
        toast.error("Sleep sync is only available on the Android app");
        return;
      }
      const { available } = await HealthConnect.isAvailable();
      if (!available) {
        toast.error("Health Connect is not available on this device");
        return;
      }
      await HealthConnect.requestHealthPermissions();

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 7 * 86400000);
      const { sessions } = await HealthConnect.getSleepForDateRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });

      if (!sessions || sessions.length === 0) {
        toast.info("No sleep data found for the last 7 days.");
        return;
      }

      let syncedNights = 0;
      for (const s of sessions) {
        const sleepDate = new Date(s.endTime).toISOString().split("T")[0];
        const { error: sleepErr } = await supabase.from("player_sleep_data").upsert({
          player_id: playerId,
          sleep_date: sleepDate,
          total_minutes: s.totalMinutes,
          deep_minutes: s.deepMinutes,
          rem_minutes: s.remMinutes,
          light_minutes: s.lightMinutes,
          awake_minutes: s.awakeMinutes,
        }, { onConflict: "player_id,sleep_date" });
        if (sleepErr) {
          console.error("Error saving sleep data for", sleepDate, sleepErr);
          continue;
        }
        syncedNights++;
      }

      if (syncedNights > 0) {
        toast.success(`Synced ${syncedNights} night${syncedNights === 1 ? "" : "s"} of sleep data!`);
        if (refetchSleep) refetchSleep();
      } else {
        toast.error("Failed to sync sleep data");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("web implementation") || err?.message?.includes("not implemented")) {
        toast.error("Sleep sync is only available on the Android app");
      } else if (err?.message?.includes("Permissions not granted")) {
        toast.error("Please grant permissions. Opening Settings...");
        HealthConnect.openHealthConnectSettings();
      } else {
        toast.error("Failed to sync sleep data");
      }
    } finally {
      setIsSyncingSleep(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingWatch(true);
    try {
      const platform = Capacitor.getPlatform();
      if (platform !== "android") {
        toast.error("Watch sync is only available on the Android app");
        setIsSyncingWatch(false);
        return;
      }
      const { available } = await HealthConnect.isAvailable();
      if (!available) {
        toast.error("Health Connect is not available on this device");
        setIsSyncingWatch(false);
        return;
      }
      
      await HealthConnect.requestHealthPermissions();
      toast.info("Scanning for watch data...");

      let syncedCount = 0;

      for (const m of motionMatches) {
        // Only sync if not already synced
        if (healthData.find(hd => hd.matchId === m.matchId && hd.matchSource === m.source)) continue;

        let endTime: Date;
        let startTime: Date;

        if (m.matchId.startsWith("practice_")) {
          const timestamp = parseInt(m.matchId.split("_")[1]);
          endTime = new Date(timestamp);
          // Estimate duration from sample count (assume 5Hz)
          const durationMs = Math.max(60000, (m.sampleCount / 5) * 1000);
          startTime = new Date(endTime.getTime() - durationMs);
        } else if (m.startedAt && m.endedAt) {
          // Real match window, persisted from the umpire's scored points.
          startTime = new Date(m.startedAt);
          endTime = new Date(m.endedAt);
        } else if (m.scoredAt) {
          // Fallback for matches scored before match windows were persisted.
          endTime = new Date(m.scoredAt);
          // Assume tournament matches are 30 mins
          startTime = new Date(endTime.getTime() - 30 * 60000);
        } else {
          continue;
        }

        try {
          const hrRes = await HealthConnect.getHeartRateForTimeRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
          const stepsRes = await HealthConnect.getStepsForTimeRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
          const calRes = await HealthConnect.getCaloriesForTimeRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });

          let hrvAvg: number | null = null;
          let spo2Avg: number | null = null;
          let spo2Min: number | null = null;
          try {
            const hrvRes = await HealthConnect.getHrvForTimeRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
            if (hrvRes.samples && hrvRes.samples.length > 0) {
              const rmssdVals = hrvRes.samples.map((s) => s.rmssd);
              hrvAvg = rmssdVals.reduce((a, b) => a + b, 0) / rmssdVals.length;
            }
            const spo2Res = await HealthConnect.getSpo2ForTimeRange({ startTime: startTime.toISOString(), endTime: endTime.toISOString() });
            if (spo2Res.samples && spo2Res.samples.length > 0) {
              const spo2Vals = spo2Res.samples.map((s) => s.percentage);
              spo2Avg = spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length;
              spo2Min = Math.min(...spo2Vals);
            }
          } catch (hrvErr) {
            // HRV/SpO2 aren't tracked by every watch — don't fail the whole sync over it
            console.error("Error fetching HRV/SpO2 for match", m.matchId, hrvErr);
          }

          let hrResting: number | null = null;
          try {
            const restingRes = await HealthConnect.getRestingHeartRate({ before: startTime.toISOString() });
            hrResting = restingRes.bpm ?? null;
          } catch (restingErr) {
            // Resting HR needs several days of watch history — not always available
            console.error("Error fetching resting HR for match", m.matchId, restingErr);
          }

          let hrRecovery: number | null = null;
          try {
            const recoveryWindowEnd = new Date(endTime.getTime() + 65000);
            const recoveryRes = await HealthConnect.getHeartRateForTimeRange({ startTime: endTime.toISOString(), endTime: recoveryWindowEnd.toISOString() });
            if (recoveryRes.samples && recoveryRes.samples.length > 0) {
              const recoveryVals = recoveryRes.samples.map((s) => s.bpm);
              hrRecovery = recoveryVals.reduce((a, b) => a + b, 0) / recoveryVals.length;
            }
          } catch (recoveryErr) {
            // No samples 1 min post-match yet if syncing immediately after the match ends
            console.error("Error fetching recovery HR for match", m.matchId, recoveryErr);
          }

          if (hrRes.samples && hrRes.samples.length > 0) {
            const hrVals = hrRes.samples.map((s: any) => s.bpm);
            const hrAvg = hrVals.reduce((a: number, b: number) => a + b, 0) / hrVals.length;
            const hrMax = Math.max(...hrVals);
            const hrMin = Math.min(...hrVals);
            
            // Simple zones
            let z1=0, z2=0, z3=0, z4=0, z5=0;
            hrVals.forEach((hr: number) => {
              if (hr < 110) z1++;
              else if (hr < 130) z2++;
              else if (hr < 150) z3++;
              else if (hr < 170) z4++;
              else z5++;
            });
            const t = hrVals.length;

            const { error: healthErr } = await supabase.from("match_health_data").upsert({
              match_id: m.matchId,
              match_source: m.source,
              player_id: playerId,
              hr_avg: hrAvg,
              hr_max: hrMax,
              hr_min: hrMin,
              hr_resting: hrResting,
              hr_recovery: hrRecovery,
              hr_zone_1_pct: (z1/t)*100,
              hr_zone_2_pct: (z2/t)*100,
              hr_zone_3_pct: (z3/t)*100,
              hr_zone_4_pct: (z4/t)*100,
              hr_zone_5_pct: (z5/t)*100,
              steps: stepsRes.steps || 0,
              calories_burned: calRes.calories || 0,
              hrv_avg: hrvAvg,
              spo2_avg: spo2Avg,
              spo2_min: spo2Min,
            }, { onConflict: "match_id,match_source,player_id" });

            if (healthErr) {
              console.error("Error saving health data for match", m.matchId, healthErr);
            } else {
              syncedCount++;
            }
          }
        } catch (err) {
          console.error("Error syncing match", m.matchId, err);
        }
      }

      if (syncedCount > 0) {
        toast.success(`Successfully synced ${syncedCount} matches!`);
        if (refetchHealth) refetchHealth();
      } else {
        toast.info("No new watch data found for your matches.");
      }
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("web implementation") || err?.message?.includes("not implemented")) {
        toast.error("Watch sync is only available on the Android app");
      } else if (err?.message?.includes("Permissions not granted")) {
        toast.error("Please grant permissions. Opening Settings...");
        HealthConnect.openHealthConnectSettings();
      } else {
        toast.error("Failed to sync watch data");
      }
    } finally {
      setIsSyncingWatch(false);
    }
  };

  const stats = useMemo(() => {
    const singles = matches.filter((m) => m.group === "Singles");
    const doubles = matches.filter((m) => m.group === "Doubles");
    const mixedDoubles = matches.filter((m) => m.group === "Mixed Doubles");

    const calcWinRate = (arr: PersonalMatch[]) => {
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
    const shotIntervals = sensorAnalytics.map((a) => a.avgShotIntervalMs).filter((v): v is number => v != null && v > 0);
    const avgShotIntervalMs = shotIntervals.length ? shotIntervals.reduce((a, b) => a + b, 0) / shotIntervals.length : null;
    const directionChanges = sensorAnalytics.reduce((s, a) => s + a.directionChanges, 0);

    return { totalSwings, smashCount, clearCount, driveCount, netShotCount, avgFatigue, lateralPct, forwardBackPct, avgShotIntervalMs, directionChanges };
  }, [sensorAnalytics]);

  const overallHealth = useMemo(() => {
    if (!healthData || !healthData.length) return null;
    const avgHr = healthData.reduce((s, a) => s + a.hrAvg, 0) / healthData.length;
    const maxHr = Math.max(...healthData.map(h => h.hrMax));
    const totalCalories = healthData.reduce((s, a) => s + a.caloriesBurned, 0);
    const avgCalories = totalCalories / healthData.length;
    const totalSteps = healthData.reduce((s, a) => s + a.steps, 0);
    const avgRecovery = healthData.reduce((s, a) => s + a.hrRecovery, 0) / healthData.length;

    const hrvVals = healthData.map((h) => h.hrvAvg).filter((v): v is number => v != null);
    const avgHrv = hrvVals.length ? hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length : null;
    const latestHrv = hrvVals.length ? hrvVals[hrvVals.length - 1] : null;

    const spo2Vals = healthData.map((h) => h.spo2Avg).filter((v): v is number => v != null);
    const avgSpo2 = spo2Vals.length ? spo2Vals.reduce((a, b) => a + b, 0) / spo2Vals.length : null;
    const spo2MinVals = healthData.map((h) => h.spo2Min).filter((v): v is number => v != null);
    const minSpo2 = spo2MinVals.length ? Math.min(...spo2MinVals) : null;

    // Readiness: compare the most recent HRV reading against the player's own trailing average
    let readiness: "above" | "below" | "typical" | null = null;
    if (avgHrv != null && latestHrv != null && hrvVals.length >= 2) {
      const delta = (latestHrv - avgHrv) / avgHrv;
      readiness = delta > 0.05 ? "above" : delta < -0.05 ? "below" : "typical";
    }

    return { avgHr, maxHr, totalCalories, avgCalories, totalSteps, avgRecovery, avgHrv, avgSpo2, minSpo2, readiness };
  }, [healthData]);

  // Dynamic Effective Data using selectedMatchId
  const isSensorsEmpty = !motionSummary;
  const effMotion = useMemo(() => {
    if (selectedMatchId === "all") return motionSummary || { matchCount: 0, avgMagnitude: 0, peakMagnitude: 0, idlePct: 0, walkingPct: 0, runningPct: 0, smashSprintPct: 0 };
    const m = motionMatches.find(x => x.matchId === selectedMatchId);
    if (!m) return motionSummary || { matchCount: 0, avgMagnitude: 0, peakMagnitude: 0, idlePct: 0, walkingPct: 0, runningPct: 0, smashSprintPct: 0 };
    return { matchCount: 1, avgMagnitude: m.avgMagnitude, peakMagnitude: m.maxMagnitude, idlePct: m.idlePct, walkingPct: m.walkingPct, runningPct: m.runningPct, smashSprintPct: m.smashSprintPct };
  }, [selectedMatchId, motionSummary, motionMatches]);
  
  const effWorkRate = useMemo(() => {
    if (selectedMatchId === "all") return motionSummary ? workRate : 0;
    const m = motionMatches.find(x => x.matchId === selectedMatchId);
    return m ? m.workRate : (motionSummary ? workRate : 0);
  }, [selectedMatchId, motionMatches, motionSummary, workRate]);

  const effSensors = useMemo(() => {
    const defaultSensors = { totalSwings: 1, smashCount: 0, clearCount: 0, driveCount: 0, netShotCount: 0, avgFatigue: 0, lateralPct: 0, forwardBackPct: 0, avgShotIntervalMs: null as number | null, directionChanges: 0 };
    if (selectedMatchId === "all") return overallSensors || defaultSensors;
    const m = sensorAnalytics.find(x => x.matchId === selectedMatchId);
    if (!m) return overallSensors || defaultSensors;
    return { totalSwings: m.totalSwings, smashCount: m.smashCount, clearCount: m.clearCount, driveCount: m.driveCount, netShotCount: m.netShotCount, avgFatigue: m.fatigueIndex, lateralPct: m.lateralPct, forwardBackPct: m.forwardBackPct, avgShotIntervalMs: m.avgShotIntervalMs, directionChanges: m.directionChanges };
  }, [selectedMatchId, overallSensors, sensorAnalytics]);
  const effSensorArr = sensorAnalytics.length > 0 ? sensorAnalytics : [{matchId: '1', avgSwingSpeed: 0, maxSwingSpeed: 0}, {matchId: '2', avgSwingSpeed: 0, maxSwingSpeed: 0}];

  const isHealthEmpty = !overallHealth;
  const effHealth = overallHealth || { avgHr: 0, maxHr: 0, avgRecovery: 0, totalCalories: 0, totalSteps: 0, avgHrv: null as number | null, avgSpo2: null as number | null, minSpo2: null as number | null, readiness: null as "above" | "below" | "typical" | null };
  const effHealthArr = healthData && healthData.length > 0 ? healthData : [{ matchId: '1', hrResting: 0, hrZone1Pct: 0, hrZone2Pct: 0, hrZone3Pct: 0, hrZone4Pct: 0, hrZone5Pct: 0 }];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
        <button
          onClick={() => setLocation(`/player/${playerId}/personal/stats/match`)}
          className={cn(
            "py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            currentSubTab === "Match Stats" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BarChart3 className="w-4 h-4 hidden sm:block" /> Match
        </button>
        <button
          onClick={() => setLocation(`/player/${playerId}/personal/stats/phone`)}
          className={cn(
            "py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            currentSubTab === "Phone" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ActivitySquare className="w-4 h-4 hidden sm:block" /> Phone
        </button>
        <button
          onClick={() => setLocation(`/player/${playerId}/personal/stats/watch`)}
          className={cn(
            "py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            currentSubTab === "Watch Data" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Watch className="w-4 h-4 hidden sm:block" /> Watch
        </button>
        <button
          onClick={() => setLocation(`/player/${playerId}/personal/stats/rallies`)}
          className={cn(
            "py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2",
            currentSubTab === "Rallies" ? "bg-white dark:bg-slate-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Route className="w-4 h-4 hidden sm:block" /> Rallies
        </button>
      </div>

      {currentSubTab === "Match Stats" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Singles</div>
              <div className="text-2xl font-black text-[var(--series-a)]">{stats.singles.winRate}%</div>
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

      {currentSubTab === "Phone" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!isSensorsEmpty && motionMatches.length > 0 && (
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700/50">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Match:</span>
              <select 
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
              >
                <option value="all">All Matches ({motionMatches.length})</option>
                {motionMatches.map(m => (
                  <option key={m.matchId} value={m.matchId}>
                    {m.tournamentName || "Practice Session"} • {m.scoredAt ? new Date(m.scoredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown Date"}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isSensorsEmpty && !isSelfTracking && (
            <div className="bg-blue-50 dark:bg-[var(--series-a)]/20 border border-[var(--series-a)] dark:border-[var(--series-a)]/30 rounded-xl p-4 flex flex-col items-center text-center">
              <Footprints className="w-5 h-5 text-[var(--series-a)] mb-2" />
              <p className="text-sm text-[var(--series-a)] dark:text-[var(--series-a)] font-medium mb-3">
                No motion data yet. You can track motion yourself, or the umpire can track it for you.
              </p>
              {isCurrentUser && (
                <button
                  onClick={() => setIsSelfTracking(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--series-a)] px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-[var(--series-a)]"
                >
                  <ActivitySquare className="w-3 h-3" />
                  Start Self-Tracking
                </button>
              )}
            </div>
          )}

          {!isSensorsEmpty && isCurrentUser && !isSelfTracking && (
            <div className="flex justify-end mt-2 mb-4">
              <button
                onClick={() => setIsSelfTracking(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--series-a)] px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-[var(--series-a)]"
              >
                <ActivitySquare className="w-4 h-4" />
                Record New Match
              </button>
            </div>
          )}
          {isSelfTracking && playerId && (
            <SelfMotionTracker userId={playerId} onSaved={() => setIsSelfTracking(false)} />
          )}

          {isCurrentUser && (
            <div className="mb-6 mt-4 flex flex-col gap-4">
              <AutoHighlightsRecorder />
              <ARReplayViewer />
              <AcousticTensionAnalyzer />
              <ShadowDrillEngine />
              <LineCallChallenge />
            </div>
          )}

          {selectedMatchId && selectedMatchId !== "all" && (
            <div className="mb-6">
              <MatchAnalyticsSection matchId={selectedMatchId} />
            </div>
          )}

          <>
            {/* Accelerometer Motion Data */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5 opacity-80"
            >
              <div className="flex items-center gap-2 mb-4">
                <ActivitySquare className="w-5 h-5 text-primary" />
                <h2 className="font-black text-slate-800 dark:text-slate-100">On-Court Motion</h2>
                <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                  {effMotion.matchCount} tracked match{effMotion.matchCount === 1 ? "" : "es"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[var(--series-a)]" />
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100">{effMotion.avgMagnitude.toFixed(1)}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      Avg Intensity
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger type="button" className="cursor-help">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                            How fast and hard you usually move around the court on average.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100">{effMotion.peakMagnitude.toFixed(1)}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      Peak Intensity
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger type="button" className="cursor-help">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                            Your absolute fastest sprint or sudden movement during the match.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[var(--series-b)]" />
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100">{effWorkRate.toFixed(0)}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      Work-Rate Score
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger type="button" className="cursor-help">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                            A score showing how hard you worked overall—higher means you were very active!
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <MotionStatBar label="Idle" pct={effMotion.idlePct} color="bg-slate-400" />
                <MotionStatBar label="Walking" pct={effMotion.walkingPct} color="bg-[var(--series-a)]" />
                <MotionStatBar label="Running" pct={effMotion.runningPct} color="bg-amber-500" />
                <MotionStatBar label="Smash Sprint" pct={effMotion.smashSprintPct} color="bg-[var(--series-b)]" />
              </div>

              {motionMatches && motionMatches.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Individual Matches</h3>
                  <div className="space-y-3">
                    {motionMatches.map((m) => (
                      <div key={m.matchId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/30">
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {m.tournamentName || "Practice Session"}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex gap-2">
                            <span>{m.scoredAt ? new Date(m.scoredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown Date"}</span>
                            <span>•</span>
                            <span>{m.group}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-sm font-black text-[var(--series-b)]">{m.workRate.toFixed(0)}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">Work-Rate</div>
                          </div>
                          {isCurrentUser && (
                            <button 
                              onClick={() => handleDeleteSession(m.matchId, m.source)}
                              className="text-slate-400 hover:text-[var(--series-b)] transition-colors p-2 -mr-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Sensor Analytics Data */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5 opacity-80"
            >
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-indigo-500" />
                    <h2 className="font-black text-slate-800 dark:text-slate-100">Swing & Movement Analysis</h2>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Shot Distribution</div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                        <div className="bg-[var(--series-b)]" style={{ width: `${(effSensors.smashCount / effSensors.totalSwings) * 100}%` }} title="Smash" />
                        <div className="bg-[var(--series-a)]" style={{ width: `${(effSensors.clearCount / effSensors.totalSwings) * 100}%` }} title="Clear" />
                        <div className="bg-amber-500" style={{ width: `${(effSensors.driveCount / effSensors.totalSwings) * 100}%` }} title="Drive" />
                        <div className="bg-emerald-500" style={{ width: `${(effSensors.netShotCount / effSensors.totalSwings) * 100}%` }} title="Net Shot" />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-muted-foreground">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--series-b)]"/> Smash</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--series-a)]"/> Clear</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/> Drive</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Net</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          Fatigue Index
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger type="button" className="cursor-help">
                                <HelpCircle className="w-3 h-3 text-slate-400" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                                Shows if you get tired. Below 1.0 means your smashes get weaker towards the end of the game.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{effSensors.avgFatigue.toFixed(2)}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{effSensors.avgFatigue < 0.9 ? 'Fading' : effSensors.avgFatigue > 1.1 ? 'Finishing Strong' : 'Consistent'}</div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          Movement Bias
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger type="button" className="cursor-help">
                                <HelpCircle className="w-3 h-3 text-slate-400" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                                How much you move side-to-side compared to forward-and-backward.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{Math.round(effSensors.lateralPct)}%</div>
                          <div className="text-[10px] text-muted-foreground font-medium">Lateral</div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          Shot Tempo
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger type="button" className="cursor-help">
                                <HelpCircle className="w-3 h-3 text-slate-400" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                                Average time between your shots. Lower means faster-paced exchanges.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                            {effSensors.avgShotIntervalMs != null ? (effSensors.avgShotIntervalMs / 1000).toFixed(1) : "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-medium">sec / shot</div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          Direction Changes
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger type="button" className="cursor-help">
                                <HelpCircle className="w-3 h-3 text-slate-400" />
                              </TooltipTrigger>
                              <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                                Explosive changes in movement direction — a rough proxy for footwork intensity.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{effSensors.directionChanges}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">total</div>
                        </div>
                      </div>
                    </div>

                    {/* Movement Profile Radar */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1">
                        Movement Profile
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger type="button" className="cursor-help">
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs px-2 py-1 max-w-[200px]">
                              How your movement splits across side-to-side, forward-back, and vertical (jump/lunge) directions on average.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart
                            data={[
                              { axis: "Lateral", pct: effSensors.lateralPct },
                              { axis: "Forward/Back", pct: effSensors.forwardBackPct },
                              { axis: "Vertical", pct: 100 - effSensors.lateralPct - effSensors.forwardBackPct < 0 ? 0 : 100 - effSensors.lateralPct - effSensors.forwardBackPct },
                            ]}
                            margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                          >
                            <PolarGrid stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "currentColor" }} className="opacity-70" />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Movement %" dataKey="pct" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                            <RechartsTooltip
                              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                              itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                              formatter={(value: any) => `${Number(value).toFixed(0)}%`}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Swing Speed Trend Line Chart */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Swing Speed Trend (Last 10 Matches)</div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={effSensorArr.slice(-10)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <XAxis dataKey="matchId" hide />
                            <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" tickFormatter={(v) => Number(v).toFixed(2)} />
                            <RechartsTooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(value: any) => Number(value).toFixed(2)}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Line type="monotone" name="Avg Speed (km/h)" dataKey="avgSwingSpeed" stroke="#6366f1" strokeWidth={3} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                            <Line type="monotone" name="Max Speed (km/h)" dataKey="maxSwingSpeed" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Fatigue Index Trend Line Chart */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Fatigue Index Trend (Last 10 Matches)</div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={effSensorArr.slice(-10)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <XAxis dataKey="matchId" hide />
                            <YAxis domain={[0, 'dataMax + 0.2']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" tickFormatter={(v) => Number(v).toFixed(1)} />
                            <RechartsTooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(value: any) => Number(value).toFixed(2)}
                            />
                            <Line type="monotone" name="Fatigue Index" dataKey="fatigueIndex" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {clubBenchmarks && clubBenchmarks.sensorSampleSize >= 3 && overallSensors && sensorAnalytics.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mt-4 space-y-4">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">You vs Club Average</div>
                        <ComparisonRow
                          label="Avg Swing Speed"
                          a={sensorAnalytics.reduce((s, x) => s + x.avgSwingSpeed, 0) / sensorAnalytics.length}
                          b={clubBenchmarks.avgSwingSpeed}
                          aLabel="You"
                          bLabel="Club"
                          suffix=" km/h"
                        />
                        <ComparisonRow
                          label="Fatigue Index"
                          a={overallSensors.avgFatigue}
                          b={clubBenchmarks.avgFatigueIndex}
                          aLabel="You"
                          bLabel="Club"
                          suffix=""
                        />
                      </div>
                    )}
                  </div>
                </motion.div>

                {trainingLoad && trainingLoad.acwr != null && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/50 p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="w-5 h-5 text-emerald-500" />
                      <h2 className="font-black text-slate-800 dark:text-slate-100">Training Load</h2>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger type="button" className="cursor-help ml-auto">
                            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs px-2 py-1 max-w-[220px]">
                            Acute:Chronic Workload Ratio — compares your last 7 days of activity to your last 28 days. A rough estimate, not medical advice.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{trainingLoad.acwr.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">ACWR</div>
                      </div>
                      <span className={cn(
                        "text-xs font-black uppercase px-3 py-1.5 rounded-full",
                        trainingLoad.riskLabel === "elevated" ? "bg-[var(--series-b)]/15 text-[var(--series-b)] dark:text-[var(--series-b)]" :
                        trainingLoad.riskLabel === "undertrained" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      )}>
                        {trainingLoad.riskLabel === "elevated" ? "Elevated Load" : trainingLoad.riskLabel === "undertrained" ? "Undertrained" : "Steady"}
                      </span>
                    </div>
                  </motion.div>
                )}
            </>
        </div>
      )}

      {currentSubTab === "Watch Data" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {!isHealthConnectEnabled ? (
            <div className="bg-blue-50 dark:bg-[var(--series-a)]/20 border border-[var(--series-a)] dark:border-[var(--series-a)]/30 rounded-xl p-6 text-center">
              <Watch className="w-8 h-8 text-[var(--series-a)] mx-auto mb-2" />
              <h3 className="font-bold text-[var(--series-a)] dark:text-[var(--series-a)] mb-1">Connect Health Connect</h3>
              <p className="text-sm text-[var(--series-a)]/80 dark:text-[var(--series-a)] max-w-sm mx-auto mb-5">
                Link your smartwatch via Android Health Connect to unlock rich insights like heart rate zones, calories burned, and sleep quality analysis to improve your game!
              </p>
              <button
                onClick={() => {
                  localStorage.setItem("hc_enabled", "true");
                  setIsHealthConnectEnabled(true);
                  handleManualSync(); // Immediately prompt permissions
                }}
                className="flex items-center justify-center mx-auto gap-2 rounded-xl bg-[var(--series-a)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--series-a)]"
              >
                Connect to Health Connect
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-left">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    Health Connect Linked
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Managing watch & sleep data sync</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => HealthConnect.openHealthConnectSettings()}
                    className="rounded-lg bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-100 border border-slate-200 dark:border-slate-600"
                  >
                    Manage Settings
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem("hc_enabled", "false");
                      setIsHealthConnectEnabled(false);
                      HealthConnect.openHealthConnectSettings();
                      toast.info("Please revoke permissions in Settings to fully disconnect.");
                    }}
                    className="rounded-lg bg-rose-50 dark:bg-[var(--series-b)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--series-b)] dark:text-[var(--series-b)] transition hover:bg-[var(--series-b)] border border-[var(--series-b)] dark:border-[var(--series-b)]/30"
                  >
                    Disconnect
                  </button>
                  {isCurrentUser && (
                    <button
                      onClick={handleDeleteHealthData}
                      className="rounded-lg bg-rose-50 dark:bg-[var(--series-b)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--series-b)] dark:text-[var(--series-b)] transition hover:bg-[var(--series-b)] border border-[var(--series-b)] dark:border-[var(--series-b)]/30"
                    >
                      Delete My Data
                    </button>
                  )}
                </div>
              </div>

              {isHealthEmpty && (
                <div className="text-center p-4">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncingWatch}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[var(--series-a)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--series-a)] disabled:opacity-50"
                    >
                      {isSyncingWatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Sync Watch Data
                    </button>
                    <button
                      onClick={() => setShowWatchInstructions(!showWatchInstructions)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-100 border border-slate-200 dark:border-slate-700"
                    >
                      How to connect
                      {showWatchInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

              {showWatchInstructions && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-6 text-left max-w-md mx-auto bg-white/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <h4 className="font-bold text-sm mb-3">Setup Instructions</h4>
                  <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
                    <li>Ensure you have the <strong>Health Connect</strong> app installed on your Android device (built-in on Android 14+).</li>
                    <li>Open your smartwatch companion app (e.g., <em>Garmin Connect</em>, <em>Samsung Health</em>, <em>Fitbit</em>, <em>Google Fit</em>).</li>
                    <li>Go to the app's settings and look for <strong>"Connected Apps"</strong> or <strong>"Data Sharing"</strong>.</li>
                    <li>Select <strong>Health Connect</strong> and allow it to write Heart Rate, Steps, and Calories data.</li>
                    <li>After playing a match and saving the score, open the IISc Badminton Club app and it will automatically read the data for that time period!</li>
                  </ol>
                </motion.div>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700/50 text-center opacity-80">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-muted-foreground uppercase">Average Heart Rate</div>
                <div className="text-3xl font-black text-red-500">{Math.round(effHealth.avgHr)} <span className="text-sm font-normal text-muted-foreground">BPM</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Max HR</div>
                  <div className="text-xl font-bold">{Math.round(effHealth.maxHr)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Recovery HR</div>
                  <div className="text-xl font-bold">{Math.round(effHealth.avgRecovery)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Calories</div>
                  <div className="text-xl font-bold text-orange-500">{Math.round(effHealth.totalCalories)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Steps</div>
                  <div className="text-xl font-bold text-[var(--series-a)]">{Math.round(effHealth.totalSteps)}</div>
                </div>
              </div>

              {(effHealth.avgHrv != null || effHealth.avgSpo2 != null) && (
                <div className="text-left">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recovery</div>
                    {effHealth.readiness && (
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-1 rounded-full",
                        effHealth.readiness === "above" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                        effHealth.readiness === "below" ? "bg-[var(--series-b)]/15 text-[var(--series-b)] dark:text-[var(--series-b)]" :
                        "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                      )}>
                        {effHealth.readiness === "above" ? "Above your average" : effHealth.readiness === "below" ? "Below your average" : "Typical for you"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                      <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Avg HRV (RMSSD)</div>
                      <div className="text-xl font-bold text-violet-500">{effHealth.avgHrv != null ? `${Math.round(effHealth.avgHrv)} ms` : "—"}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                      <div className="text-xs text-muted-foreground uppercase font-bold mb-1">SpO2 (avg / min)</div>
                      <div className="text-xl font-bold text-cyan-500">
                        {effHealth.avgSpo2 != null ? `${effHealth.avgSpo2.toFixed(0)}%` : "—"}
                        {effHealth.minSpo2 != null && <span className="text-sm text-muted-foreground font-medium"> / {effHealth.minSpo2.toFixed(0)}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {clubBenchmarks && clubBenchmarks.healthSampleSize >= 3 && overallHealth && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-left">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">You vs Club Average</div>
                  <ComparisonRow
                    label="Avg Heart Rate"
                    a={overallHealth.avgHr}
                    b={clubBenchmarks.avgHr}
                    aLabel="You"
                    bLabel="Club"
                    suffix=" bpm"
                  />
                </div>
              )}

              <div className="text-left">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sleep (Last 7 Nights)</div>
                  <button
                    onClick={handleSyncSleep}
                    disabled={isSyncingSleep}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isSyncingSleep ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Moon className="w-3 h-3" />}
                    Sync Sleep
                  </button>
                </div>

                {sleepData.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-sm text-muted-foreground">
                    No sleep data synced yet. Tap "Sync Sleep" after wearing your watch overnight.
                  </div>
                ) : (
                  <>
                    {(() => {
                      const lastNight = sleepData[sleepData.length - 1];
                      const hours = Math.floor(lastNight.totalMinutes / 60);
                      const mins = Math.round(lastNight.totalMinutes % 60);
                      return (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl mb-3">
                          <div className="text-xs text-muted-foreground uppercase font-bold mb-1">Last Night</div>
                          <div className="text-xl font-bold text-indigo-500">{hours}h {mins}m</div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {Math.round(lastNight.deepMinutes)}m deep · {Math.round(lastNight.remMinutes)}m REM · {Math.round(lastNight.lightMinutes)}m light
                          </div>
                        </div>
                      );
                    })()}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sleepData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <XAxis dataKey="sleepDate" tick={{ fontSize: 9, fill: 'currentColor' }} className="opacity-50" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: "short" })} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                            <RechartsTooltip
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              formatter={(value: any) => `${Math.round(Number(value))}m`}
                            />
                            <Bar dataKey="deepMinutes" name="Deep" stackId="s" fill="#4338ca" />
                            <Bar dataKey="remMinutes" name="REM" stackId="s" fill="#6366f1" />
                            <Bar dataKey="lightMinutes" name="Light" stackId="s" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 space-y-6">
                    {/* Fitness Progress Line Chart */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-left">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Fitness Progress (Resting vs Recovery HR)</div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={effHealthArr.slice(-10)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <XAxis dataKey="matchId" hide />
                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" />
                            <RechartsTooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ display: 'none' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Line type="monotone" name="Resting HR (BPM)" dataKey="hrResting" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                            <Line type="monotone" name="Recovery HR (BPM)" dataKey="hrRecovery" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2, fill: '#0ea5e9' }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* HR Zones Stacked Bar Chart */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-left">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">HR Zones (Last 10 Matches)</div>
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={effHealthArr.slice(-10)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                            <XAxis dataKey="matchId" hide />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" />
                            <RechartsTooltip
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              labelStyle={{ display: 'none' }}
                            />
                            <Bar dataKey="hrZone1Pct" name="Zone 1 (Warm Up)" stackId="a" fill="#94a3b8" />
                            <Bar dataKey="hrZone2Pct" name="Zone 2 (Fat Burn)" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="hrZone3Pct" name="Zone 3 (Cardio)" stackId="a" fill="#10b981" />
                            <Bar dataKey="hrZone4Pct" name="Zone 4 (Hard)" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="hrZone5Pct" name="Zone 5 (Peak)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* HRV Trend Line Chart */}
                    {effHealth.avgHrv != null && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-left">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-3">HRV Trend (Last 10 Matches)</div>
                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={effHealthArr.slice(-10)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-5" />
                              <XAxis dataKey="matchId" hide />
                              <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} className="opacity-50" />
                              <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                labelStyle={{ display: 'none' }}
                              />
                              <Line type="monotone" name="HRV (ms RMSSD)" dataKey="hrvAvg" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {currentSubTab === "Rallies" && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {motionMatches.length === 0 ? (
            <div className="bg-blue-50 dark:bg-[var(--series-a)]/20 border border-[var(--series-a)] dark:border-[var(--series-a)]/30 rounded-xl p-4 flex flex-col items-center text-center">
              <Route className="w-5 h-5 text-[var(--series-a)] mb-2" />
              <p className="text-sm text-[var(--series-a)] dark:text-[var(--series-a)] font-medium">
                No tracked matches yet. Record a practice session or umpire a match with motion tracking on to see rally breakdowns and court paths here.
              </p>
            </div>
          ) : (
            (() => {
              const effectiveId = selectedRallyMatchId || motionMatches[0].matchId;
              const selected = motionMatches.find(m => m.matchId === effectiveId) ?? motionMatches[0];
              const matchSource = selected.source as MatchSource;
              return (
                <>
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700/50">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Match:</span>
                    <select
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={effectiveId}
                      onChange={(e) => setSelectedRallyMatchId(e.target.value)}
                    >
                      {motionMatches.map(m => (
                        <option key={m.matchId} value={m.matchId}>
                          {m.tournamentName || "Practice Session"} • {m.scoredAt ? new Date(m.scoredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown Date"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <RallyBreakdown matchId={selected.matchId} matchSource={matchSource} />
                  <PathTracingEntry matchId={selected.matchId} matchSource={matchSource} userId={isCurrentUser ? (playerId ?? null) : null} sessionTimestamp={selected.scoredAt} />
                </>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

function TrainingSection() {
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrainingData = async () => {
      if (!session?.user?.email) {
        setError("You must be logged in with an email to view ACE training data.");
        setLoading(false);
        return;
      }

      try {
        const aceUrl = import.meta.env.VITE_ACE_API_URL;
        const aceSecret = import.meta.env.VITE_ACE_API_SECRET;
        
        if (!aceUrl || !aceSecret) {
          setError("ACE API configuration is missing.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${aceUrl}?email=${encodeURIComponent(session.user.email)}`, {
          headers: {
            'Authorization': `Bearer ${aceSecret}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `ACE server returned ${res.status}`);
        }

        const jsonData = await res.json();
        setData(jsonData);
      } catch (err: any) {
        setError("Please create an account on the ACE app with the same email id.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingData();
  }, [session?.user?.email]);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-[var(--series-a)]/10 to-cyan-500/10 rounded-2xl shadow-md border border-[var(--series-a)] dark:border-[var(--series-a)]/30 p-6">
        <div className="text-center mb-6">
          <Dumbbell className="w-8 h-8 text-[var(--series-a)] dark:text-[var(--series-a)] mx-auto mb-3" />
          <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-1">ACE Training Hub</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">Live data imported from the Brainy app</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[var(--series-a)] border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-slate-500">Syncing with ACE...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        ) : data && (
          <div className="space-y-6">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Total Sessions</p>
                <p className="text-2xl font-black text-[var(--series-a)] dark:text-[var(--series-a)]">{data.sessions?.length || 0}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Active Goals</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{data.goals?.length || 0}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center col-span-2 md:col-span-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Current Habits</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{data.habits?.length || 0}</p>
              </div>
            </div>

            {/* Recent Sessions */}
            {data.sessions && data.sessions.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                  <ActivitySquare className="w-4 h-4 mr-2 text-[var(--series-a)]" /> Recent Sessions
                </h3>
                <div className="space-y-2">
                  {data.sessions.slice(0, 3).map((session: any) => (
                    <div key={session.id} className="bg-white dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{session.title}</p>
                        <p className="text-xs text-slate-500 capitalize">{session.type} • {session.duration_mins} mins</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-300">
                        {new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Goals */}
            {data.goals && data.goals.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2 text-emerald-500" /> Active Goals
                </h3>
                <div className="space-y-3">
                  {data.goals.map((goal: any) => (
                    <div key={goal.id} className="bg-white dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{goal.title}</p>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{goal.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${goal.progress}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
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
  
  const [location, setLocation] = useLocation();
  const subMatch = location.match(/^\/player\/[^/]+\/personal\/me\/([^/]+)/);
  const activeTab = subMatch ? subMatch[1].toLowerCase() : "profile";
  
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
      const { error } = await supabase.from("players").update({ status: newStatus } as any).eq("id", profile.id);
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
      icon: Bell,
      label: "My Subscriptions",
      description: "Manage match and player alerts",
      href: "/profile/subscriptions",
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

      {/* Tabs Toggle */}
      <div className="flex p-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setLocation(`/player/${profile?.id}/personal/me/profile`)}
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
          onClick={() => setLocation(`/player/${profile?.id}/personal/me/settings`)}
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
                    <Icon className={cn("w-5 h-5", item.danger ? "text-[var(--series-b)]" : "text-muted-foreground group-hover:text-primary")} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn("font-semibold", item.danger ? "text-[var(--series-b)] dark:text-[var(--series-b)]" : "text-foreground dark:text-foreground")}>
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
              className="w-full flex items-center justify-center gap-2 border-[var(--series-b)] dark:border-[var(--series-b)]/50 hover:bg-rose-50 dark:hover:bg-[var(--series-b)]/30 text-[var(--series-b)] dark:text-[var(--series-b)] hover:text-[var(--series-b)] py-6 rounded-xl transition-colors font-bold"
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

export default function PlayerPersonalPage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [player, setPlayer] = useState<any | null>(null);
  const [formatTab, setFormatTab] = useState<FormatTab>("Singles");

  // Derive active tab from location
  let activeTab: MainTab = "Home";
  let subTab: "Match Stats" | "Phone" | "Watch Data" | "Rallies" = "Match Stats";

  const match = location.match(/^\/player\/[^/]+\/personal\/?([^/]*)\/?([^/]*)/);
  if (match) {
    const tabParam = match[1]?.toLowerCase();
    const subParam = match[2]?.toLowerCase();
    if (tabParam === "matches") activeTab = "Matches";
    else if (tabParam === "stats") {
      activeTab = "Stats";
      if (subParam === "phone") subTab = "Phone";
      else if (subParam === "watch") subTab = "Watch Data";
      else if (subParam === "rallies") subTab = "Rallies";
    }
    else if (tabParam === "training") activeTab = "Training";
    else if (tabParam === "me") activeTab = "Me";
  }

  const navigateTab = (tab: MainTab) => {
    const basePath = `/player/${id}/personal`;
    switch (tab) {
      case "Home": setLocation(`${basePath}/home`); break;
      case "Matches": setLocation(`${basePath}/matches`); break;
      case "Stats": setLocation(`${basePath}/stats/match`); break;
      case "Training": setLocation(`${basePath}/training`); break;
      case "Me": setLocation(`${basePath}/me`); break;
      default: setLocation(`${basePath}/home`);
    }
  };

  useEffect(() => {
    if (!id) return;
    // Redirect from /player/:id/personal to /player/:id/personal/home
    if (location === `/player/${id}/personal`) {
      setLocation(`/player/${id}/personal/home`);
    }
    fetchPlayer(id).then(setPlayer).catch(() => {});
  }, [id, location, setLocation]);


  const { data, isLoading } = usePlayerPersonal(id);
  const { matches: fullMatches, loading: fullMatchesLoading } = usePlayerMatches(id);
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Ensure users can only view their own personal space
  if (profile && profile.id !== id) {
    return <Redirect to={`/player/${id}`} />;
  }

  const matches = data?.matches ?? [];
  const motionSummary = data?.motion ?? null;
  const motionMatches = data?.motionMatches ?? [];
  const sensorAnalytics = data?.sensorAnalytics ?? [];
  const workRate = motionSummary ? motionSummary.runningPct + motionSummary.smashSprintPct * 2 : 0;

  const isWinner = (m: any) => {
    const isTeam1 = m.player1_id === player?.id || m.team1_partner_id === player?.id;
    if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
    const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  };
  const tournamentMatches = fullMatches?.filter((m: any) => m.is_friendly === false) || [];
  const recentTournament = tournamentMatches.slice(0, 5).map((m: any) => isWinner(m) ? "W" : "L").reverse();
  const tournamentStreak = recentTournament.join("");

  if (isLoading || fullMatchesLoading || !player) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] pb-32 lg:pb-0 lg:flex">
      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-border bg-card z-50 py-6 px-4">
        {/* Logo / Brand & Actions */}
        <div className="flex flex-col gap-5 px-2 mb-8">
          <Link href="/">
            <div className="flex items-center gap-3 group w-full cursor-pointer">
              <img
                src={`${import.meta.env.BASE_URL}iisc-logo.png`}
                alt="IISc Logo"
                className="h-9 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-[14px] tracking-tight text-foreground dark:text-foreground hidden xl:block whitespace-nowrap text-left">
                IISc Badminton Club
              </span>
            </div>
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
          {MAIN_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => navigateTab(tab)}
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
            <Link href={`/player/${profile.id}/personal`}>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full hover:bg-slate-100 dark:hover:bg-slate-800/60 group mt-1 cursor-pointer">
                <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors text-left">
                    {profile.full_name?.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate text-left">{profile.email}</span>
                </div>
              </div>
            </Link>
          )}
          
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[var(--series-b)]/80 hover:text-[var(--series-b)] hover:bg-rose-50 dark:hover:bg-[var(--series-b)]/10 transition-all w-full mt-1"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 lg:pt-8 pb-8">
        {/* Hero */}
        <div className="relative overflow-hidden px-5 pt-6 pb-7 lg:px-8 lg:pt-8 mb-6">
          <div className="grid-texture absolute inset-0 opacity-60" />
          <div className="orb orb-volt absolute -top-24 -right-16 h-72 w-72" />
          <div className="orb orb-cyan absolute -bottom-16 left-1/4 h-44 w-44" />

          {/* Top Actions removed - now handled by global Navigation */}

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
                    {tournamentStreak && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary">
                        <Flame className="h-3.5 w-3.5" />
                        {tournamentStreak}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                    {player?.email && player?.is_guest === false && player?.status && (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[200px] sm:max-w-xs">{player.email}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--series-a)] text-[var(--series-a)] dark:bg-[var(--series-a)]/40 dark:text-[var(--series-a)] px-1.5 py-0.5 rounded-md border border-[var(--series-a)] dark:border-[var(--series-a)]/50">
                          BRAINMINTON Linked
                        </span>
                      </div>
                    )}
                    {player?.created_at && (
                      <div className="flex items-center gap-1.5">
                        {player?.email && <span className="opacity-50 hidden sm:inline">•</span>}
                        <span>Member since {new Date(player.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              

            </div>
          </div>
        </div>

        {/* Content Sections */}
        {activeTab === "Home" && <HomeSection player={player} matches={matches} fullMatches={fullMatches} currentUser={profile} />}
        {activeTab === "Matches" && <MatchesSection matches={matches} fullMatches={fullMatches} formatTab={formatTab} setFormatTab={setFormatTab} currentUser={profile} />}
        {activeTab === "Stats" && <StatsSection matches={matches} motionSummary={motionSummary} motionMatches={motionMatches} workRate={workRate} sensorAnalytics={sensorAnalytics} playerId={id} isCurrentUser={profile?.id === player?.id} currentSubTab={subTab} />}
        {activeTab === "Training" && <TrainingSection />}
        {activeTab === "Me" && <MeSection player={player} />}
      </div>

      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div 
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-around items-end px-1 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => navigateTab(tab)}
            className={`relative flex-1 min-w-0 flex flex-col items-center pt-2 pb-1 px-0.5 cursor-pointer ${
              activeTab === tab
                ? "text-[#ccff00]"
                : "text-muted-foreground hover:text-foreground dark:hover:text-foreground"
            }`}
          >
            <div className="mb-0.5 transform scale-90 opacity-90">
              {getTabIcon(tab)}
            </div>
            <span className="text-[11px] font-semibold">{tab}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
