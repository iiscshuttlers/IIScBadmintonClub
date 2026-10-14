import { MatchesSection, PersonalMatchCardItem } from "@/components/personal/PersonalMatchesSection";
import { TrainingSection } from "@/components/personal/PersonalTrainingSection";
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
import { useTrainingLoad } from "@/hooks/useTrainingLoad";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useClubBenchmarks } from "@/hooks/useClubBenchmarks";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { useAuth } from "@/contexts/AuthContext";
import { MatchCard as FeedMatchCard } from "@/components/feed/MatchCard";
import { shareMatch } from "@/lib/shareMatch";
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

const MAIN_TABS = ["Home", "Matches", "Stats", "Training"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const FORMAT_TABS = ["All", "Singles", "Doubles", "Mixed Doubles"] as const;
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
      const isTeam1Winner = m.winner_side ? m.winner_side === 1 : (m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id);
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
              onClick={() => setLocation(`/player/${player.id}/personal/matches`)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-all hover:gap-1.5"
            >
              View all matches <ArrowUpRight className="h-3.5 w-3.5" />
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


function StatsSection({ matches, fullMatches = [], player, motionSummary, motionMatches, workRate, sensorAnalytics, playerId, isCurrentUser, currentSubTab }: { matches: PersonalMatch[]; fullMatches?: any[]; player?: any; motionSummary: any; motionMatches: MotionMatch[]; workRate: number; sensorAnalytics: any[]; playerId?: string; isCurrentUser?: boolean; currentSubTab: "Match Stats" | "Phone" | "Watch Data" | "Rallies" }) {
  const [, setLocation] = useLocation();
  const { confirm } = useConfirm();
  const allMatchIds = useMemo(() => {
    const ids = new Set(matches.map(m => m.id));
    motionMatches.forEach(m => ids.add(m.matchId));
    return Array.from(ids);
  }, [matches, motionMatches]);
  const healthData: any[] = [];
  const refetchHealth = async () => {};
  const sleepData: any[] = [];
  const refetchSleep = async () => {};
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
        supabase.from("match_health_data" as any).delete().eq("player_id", playerId),
        supabase.from("player_sleep_data" as any).delete().eq("player_id", playerId),
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
        const { error: sleepErr } = await supabase.from("player_sleep_data" as any).upsert({
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

            const { error: healthErr } = await supabase.from("match_health_data" as any).upsert({
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
              calories_burned: 0, // TotalCaloriesBurned permission removed per Google Play policy
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
      {true && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Category Win Rate Cards */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Performance by Discipline</h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Singles</span>
                  <Swords className="w-3.5 h-3.5 text-[var(--series-a)]" />
                </div>
                <div className="text-2xl font-black text-[var(--series-a)]">{stats.singles.winRate}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stats.singles.count} matches</div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Doubles</span>
                  <Users className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div className="text-2xl font-black text-green-500">{stats.doubles.winRate}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stats.doubles.count} matches</div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Mixed</span>
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-amber-500">{stats.mixedDoubles.winRate}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stats.mixedDoubles.count} matches</div>
              </div>
            </div>
          </div>

          {/* Detailed Performance Metrics */}
          {(() => {
            const getGroup = (c?: string) => {
              const cat = (c || "").toUpperCase();
              if (cat === "MS" || cat === "WS" || cat.includes("SINGLES")) return "Singles";
              if (cat === "MD" || cat === "WD" || (cat.includes("DOUBLES") && !cat.includes("MIXED"))) return "Doubles";
              if (cat === "XD" || cat.includes("MIXED")) return "Mixed Doubles";
              return "Singles";
            };

            const isWin = (m: any) => {
              if (typeof m.won === "boolean") return m.won;
              const pId = playerId;
              if (!pId) return false;
              const isTeam1 = m.player1_id === pId || m.team1_partner_id === pId || m.player1?.id === pId;
              if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
              const isTeam1Winner = m.winner_side ? m.winner_side === 1 : (m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id || m.winner_id === m.player1?.id);
              return isTeam1 ? isTeam1Winner : !isTeam1Winner;
            };

            const matchesToUse = fullMatches && fullMatches.length > 0 ? fullMatches : matches;
            const total = matchesToUse.length;
            const wins = matchesToUse.filter(isWin).length;
            const losses = total - wins;
            const tourneyMatches = matchesToUse.filter((m: any) => m.is_friendly === false);
            const friendlyMatches = matchesToUse.filter((m: any) => m.is_friendly !== false);

            let straightSets = 0;
            let decidersPlayed = 0;
            let decidersWon = 0;

            matchesToUse.forEach((m: any) => {
              const won = isWin(m);
              const scoreStr = m.match_score || m.score || "";
              if (!scoreStr) return;
              const sets = scoreStr.split(/,| /).map((s: string) => s.trim()).filter(Boolean);
              if (sets.length === 2 && won) {
                straightSets++;
              } else if (sets.length >= 3) {
                decidersPlayed++;
                if (won) decidersWon++;
              }
            });

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total Record</div>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-100">
                      {wins}W - {losses}L
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{total ? Math.round((wins / total) * 100) : 0}% win rate</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Straight Sets</div>
                    <div className="text-xl font-black text-emerald-500">
                      {straightSets}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">2-0 sweeps</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">3-Set Clutch</div>
                    <div className="text-xl font-black text-amber-500">
                      {decidersPlayed > 0 ? `${Math.round((decidersWon / decidersPlayed) * 100)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{decidersWon} of {decidersPlayed} deciders</div>
                  </div>

                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-700/50">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Tourney vs Club</div>
                    <div className="text-xl font-black text-primary">
                      {tourneyMatches.length} / {friendlyMatches.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Tourneys / Friendlies</div>
                  </div>
                </div>

                {/* Rating & Elo Summary */}
                {player && (
                  <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">Rating & Elo Skill Breakdown</h4>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                        Overall {Math.round(player.elo_rating ?? 1200)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Singles Elo</div>
                        <div className="text-lg font-black text-foreground mt-1">{Math.round(player.singles_elo ?? player.elo_rating ?? 1200)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Doubles Elo</div>
                        <div className="text-lg font-black text-foreground mt-1">{Math.round(player.doubles_elo ?? player.elo_rating ?? 1200)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Mixed Elo</div>
                        <div className="text-lg font-black text-foreground mt-1">{Math.round(player.mixed_elo ?? player.elo_rating ?? 1200)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
          {motionMatches.length > 0 && <MotionAnalyticsPanels motionMatches={motionMatches} />}
        </div>
      )}
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
    default:
      return null;
  }
}

export default function PlayerPersonalPage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [player, setPlayer] = useState<any | null>(null);
  const [formatTab, setFormatTab] = useState<FormatTab>("All");

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
  }

  const navigateTab = (tab: MainTab) => {
    const basePath = `/player/${id}/personal`;
    switch (tab) {
      case "Home": setLocation(`${basePath}/home`); break;
      case "Matches": setLocation(`${basePath}/matches`); break;
      case "Stats": setLocation(`${basePath}/stats/match`); break;
      case "Training": setLocation(`${basePath}/training`); break;
      default: setLocation(`${basePath}/home`);
    }
  };

  useEffect(() => {
    if (!id) return;
    // Redirect from /player/:id/personal to /player/:id/personal/home.
    // Use replace so it doesn't leave a history entry that bounces the browser
    // Back button straight back to /home.
    if (location === `/player/${id}/personal`) {
      setLocation(`/player/${id}/personal/home`, { replace: true });
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
    const isTeam1Winner = m.winner_side ? m.winner_side === 1 : (m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id);
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-3 lg:pt-8 pb-6">
        {/* Hero */}
        <div className="relative overflow-hidden px-5 pt-3 pb-3 lg:px-8 lg:pt-8 lg:pb-7 mb-3">
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
                    <Link href={`/player/${id}`}>
                      <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700">
                        <User className="w-3.5 h-3.5" /> Public Profile →
                      </button>
                    </Link>
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
        {activeTab === "Stats" && <StatsSection matches={matches} fullMatches={fullMatches} player={player} motionSummary={motionSummary} motionMatches={motionMatches} workRate={workRate} sensorAnalytics={sensorAnalytics} playerId={id} isCurrentUser={profile?.id === player?.id} currentSubTab={subTab} />}
        {activeTab === "Training" && <TrainingSection />}
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
