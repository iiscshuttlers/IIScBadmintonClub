import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
  Users, Trophy, Activity, Clock, TrendingUp, TrendingDown,
  Zap, CheckCircle, XCircle, AlertTriangle, BarChart3, Download, Database
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { format, subDays, parseISO } from "date-fns";

interface Stats {
  totalPlayers: number;
  approvedPlayers: number;
  pendingPlayers: number;
  totalMatches: number;
  matchesThisWeek: number;
  pendingMatches: number;
  avgElo: number;
  topPlayer: { name: string; elo: number } | null;
  biggestGainerWeek: { name: string; gain: number } | null;
  eloDistribution: { label: string; count: number; color: string }[];
  matchVolumeData: { date: string; matches: number }[];
  dbLatency: number;
}

const TIER_BANDS = [
  { label: "Bronze", min: 0, max: 999, color: "bg-orange-400" },
  { label: "Silver", min: 1000, max: 1199, color: "bg-slate-400" },
  { label: "Gold", min: 1200, max: 1399, color: "bg-yellow-400" },
  { label: "Platinum", min: 1400, max: 1599, color: "bg-cyan-400" },
  { label: "Diamond", min: 1600, max: 1799, color: "bg-blue-400" },
  { label: "Grandmaster", min: 1800, max: 99999, color: "bg-rose-400" },
];

export function AdminStatsOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const startTime = performance.now();
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [playersRes, matchesRes, weekMatchesRes, pendingMatchRes, pendingPlayersRes] =
          await Promise.all([
            supabase.from("players").select("id, full_name, elo_rating, is_approved").is("deleted_at", null),
            supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
            supabase.from("matches").select("id, player1_id, player2_id, elo_change_p1, elo_change_p2, created_at").eq("status", "confirmed").gte("created_at", since7d),
            supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "pending"),
            supabase.from("players").select("id", { count: "exact", head: true }).eq("is_approved", false).is("deleted_at", null),
          ]);

        const players = playersRes.data ?? [];
        const matches = matchesRes.data ?? []; // Not full matches, just count
        const weekMatches = weekMatchesRes.data ?? [];

        // Calculate Match Volume for last 7 days
        const volumeMap: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = format(subDays(new Date(), i), "MMM d");
          volumeMap[d] = 0;
        }
        weekMatches.forEach((m) => {
          const d = format(parseISO(m.created_at), "MMM d");
          if (volumeMap[d] !== undefined) volumeMap[d]++;
        });
        const matchVolumeData = Object.entries(volumeMap).map(([date, matches]) => ({ date, matches }));

        // ELO distribution
        const eloDistribution = TIER_BANDS.map((band) => ({
          label: band.label,
          color: band.color,
          count: players.filter((p) => (p.elo_rating ?? 1200) >= band.min && (p.elo_rating ?? 1200) <= band.max).length,
        }));

        const avgElo = players.length
          ? Math.round(players.reduce((s, p) => s + (p.elo_rating ?? 1200), 0) / players.length)
          : 1200;

        const topPlayer = players.sort((a, b) => (b.elo_rating ?? 0) - (a.elo_rating ?? 0))[0];

        // Biggest gainer this week
        const gains: Record<string, number> = {};
        for (const m of weekMatches) {
          if (m.elo_change_p1 != null) gains[m.player1_id] = (gains[m.player1_id] ?? 0) + m.elo_change_p1;
          if (m.elo_change_p2 != null) gains[m.player2_id] = (gains[m.player2_id] ?? 0) + m.elo_change_p2;
        }
        const topGainerId = Object.entries(gains).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topGainerData = topGainerId
          ? { name: players.find((p) => p.id === topGainerId)?.full_name ?? "Unknown", gain: gains[topGainerId] }
          : null;

        setStats({
          totalPlayers: players.filter((p) => p.is_approved).length,
          approvedPlayers: players.filter((p) => p.is_approved).length,
          pendingPlayers: pendingPlayersRes.count ?? 0,
          totalMatches: matchesRes.count ?? 0,
          matchesThisWeek: weekMatches.length,
          pendingMatches: pendingMatchRes.count ?? 0,
          avgElo,
          topPlayer: topPlayer ? { name: topPlayer.full_name, elo: topPlayer.elo_rating ?? 1200 } : null,
          biggestGainerWeek: topGainerData,
          eloDistribution,
          matchVolumeData,
          dbLatency: Math.round(performance.now() - startTime),
        });
      } catch (e) {
        console.error("AdminStatsOverview error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const kpis = [
    { label: "Approved Players", value: stats.approvedPlayers, icon: Users, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Pending Approval", value: stats.pendingPlayers, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", alert: stats.pendingPlayers > 0 },
    { label: "Total Matches", value: stats.totalMatches, icon: Trophy, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Matches This Week", value: stats.matchesThisWeek, icon: Activity, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20" },
    { label: "Pending Matches", value: stats.pendingMatches, icon: Clock, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/20", alert: stats.pendingMatches > 0 },
    { label: "Avg ELO", value: stats.avgElo, icon: BarChart3, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950/20" },
    { label: "Top Player", value: stats.topPlayer?.name?.split(" ")[0] ?? "—", sub: stats.topPlayer ? `${stats.topPlayer.elo} ELO` : "", icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Biggest Gainer (7d)", value: stats.biggestGainerWeek?.name?.split(" ")[0] ?? "—", sub: stats.biggestGainerWeek ? `+${stats.biggestGainerWeek.gain} ELO` : "No matches yet", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "DB Latency", value: `${stats.dbLatency}ms`, icon: Database, color: stats.dbLatency > 500 ? "text-rose-500" : "text-sky-500", bg: stats.dbLatency > 500 ? "bg-rose-50 dark:bg-rose-950/20" : "bg-sky-50 dark:bg-sky-950/20" },
  ];

  const maxCount = Math.max(...stats.eloDistribution.map((d) => d.count), 1);

  const exportToCsv = async (type: "players" | "matches") => {
    try {
      const { data, error } = await supabase.from(type).select("*");
      if (error) throw error;
      if (!data || data.length === 0) return;
      
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map(row => Object.values(row).map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(",")).join("\n");
      const csv = `${headers}\n${rows}`;
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iisc_shuttlers_${type}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" /> Platform Overview
        </h2>
        <div className="flex gap-2">
          <button onClick={() => exportToCsv("players")} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Players CSV
          </button>
          <button onClick={() => exportToCsv("matches")} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Matches CSV
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl p-4 border ${kpi.alert ? "border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20" : `border-slate-200 dark:border-slate-800 ${kpi.bg}`}`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-5 h-5 ${kpi.color}`} />
                {kpi.alert && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-white leading-none mb-1">
                {kpi.value}
              </div>
              {kpi.sub && <div className="text-xs font-bold text-slate-400">{kpi.sub}</div>}
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {kpi.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ELO Distribution Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-black text-slate-700 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-500" /> ELO Distribution
        </h3>
        <div className="space-y-2.5">
          {stats.eloDistribution.map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-24 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                {band.label}
              </span>
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(band.count / maxCount) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full ${band.color} opacity-80`}
                />
              </div>
              <span className="w-6 text-xs font-black text-slate-600 dark:text-slate-300 text-right shrink-0">
                {band.count}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Match Volume Over Time */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-black text-slate-700 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-500" /> Match Volume (Last 7 Days)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.matchVolumeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} allowDecimals={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc', fontWeight: 'bold' }}
                itemStyle={{ color: '#a78bfa' }}
                cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Line type="monotone" dataKey="matches" name="Matches" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
