import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  Flame,
  AlertTriangle,
  Users,
  Swords,
  Trophy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import HealthConnect from "@/lib/healthConnect";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/contexts/ConfirmContext";
import type { PersonalMatch, MotionMatch } from "@/hooks/usePlayerPersonal";

export function MotionStatBar({ label, pct, color }: { label: string; pct: number; color: string }) {
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

export function IntensityTrendChart({ motionMatches }: { motionMatches: MotionMatch[] }) {
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
            dot={{ r: 3, fill: "#24252a", stroke: "#f59e0b", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
            animationDuration={1200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonRow({
  label,
  a,
  b,
  aLabel,
  bLabel,
  suffix = "%",
}: {
  label: string;
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
  suffix?: string;
}) {
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

export function MotionAnalyticsPanels({ motionMatches }: { motionMatches: MotionMatch[] }) {
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

export interface PersonalStatsSectionProps {
  matches: PersonalMatch[];
  fullMatches?: any[];
  player?: any;
  motionSummary: any;
  motionMatches: MotionMatch[];
  workRate: number;
  sensorAnalytics: any[];
  playerId?: string;
  isCurrentUser?: boolean;
  currentSubTab?: "Match Stats" | "Phone" | "Watch Data" | "Rallies";
}

export function PersonalStatsSection({
  matches,
  fullMatches = [],
  player,
  motionMatches,
  playerId,
}: PersonalStatsSectionProps) {
  const { confirm } = useConfirm();

  const stats = useMemo(() => {
    const singles = matches.filter((m) => m.group === "Singles");
    const doubles = matches.filter((m) => m.group === "Doubles");
    const mixedDoubles = matches.filter((m) => m.group === "Mixed Doubles");

    const calcWinRate = (arr: PersonalMatch[]) => {
      const wins = arr.filter((m) => m.won === true).length;
      const total = arr.filter((m) => m.won !== null).length;
      return total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
    };

    return {
      singles: { count: singles.length, winRate: calcWinRate(singles) },
      doubles: { count: doubles.length, winRate: calcWinRate(doubles) },
      mixedDoubles: { count: mixedDoubles.length, winRate: calcWinRate(mixedDoubles) },
    };
  }, [matches]);

  const isWin = (m: any) => {
    if (typeof m.won === "boolean") return m.won;
    const pId = playerId;
    if (!pId) return false;
    const isTeam1 = m.player1_id === pId || m.team1_partner_id === pId || m.player1?.id === pId;
    if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
    const isTeam1Winner = m.winner_side
      ? m.winner_side === 1
      : m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id || m.winner_id === m.player1?.id;
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
    <div className="space-y-5">
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

        {motionMatches.length > 0 && <MotionAnalyticsPanels motionMatches={motionMatches} />}
      </div>
    </div>
  );
}
