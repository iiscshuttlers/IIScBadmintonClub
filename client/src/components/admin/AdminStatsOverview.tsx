import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { adminService } from "@/services/adminService";
import {
  Users, Activity, Zap, AlertTriangle, BarChart3, Database
} from "lucide-react";

interface Stats {
  totalPlayers: number;
  approvedPlayers: number;
  pendingPlayers: number;
  avgElo: number;
  topPlayer: { name: string; elo: number } | null;
  eloDistribution: { label: string; count: number; color: string }[];
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
        const {
          players,
          pendingPlayersCount,
          dbLatency,
        } = await adminService.fetchAdminStatsOverview();

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

        setStats({
          totalPlayers: players.filter((p) => p.is_approved).length,
          approvedPlayers: players.filter((p) => p.is_approved).length,
          pendingPlayers: pendingPlayersCount,
          avgElo,
          topPlayer: topPlayer ? { name: topPlayer.full_name, elo: topPlayer.elo_rating ?? 1200 } : null,
          eloDistribution,
          dbLatency,
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
    { label: "Approved Players", value: stats.approvedPlayers, icon: Users, color: "text-primary", bg: "bg-primary/10 dark:bg-primary/20" },
    { label: "Pending Approval", value: stats.pendingPlayers, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", alert: stats.pendingPlayers > 0 },
    { label: "Avg ELO", value: stats.avgElo, icon: BarChart3, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950/20" },
    { label: "Top Player", value: stats.topPlayer?.name?.split(" ")[0] ?? "—", sub: stats.topPlayer ? `${stats.topPlayer.elo} ELO` : "", icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "DB Latency", value: `${stats.dbLatency}ms`, icon: Database, color: stats.dbLatency > 500 ? "text-rose-500" : "text-sky-500", bg: stats.dbLatency > 500 ? "bg-rose-50 dark:bg-rose-950/20" : "bg-sky-50 dark:bg-sky-950/20" },
  ];

  const maxCount = Math.max(...stats.eloDistribution.map((d) => d.count), 1);



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Platform Overview
        </h2>
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
              <div className="text-2xl font-black text-slate-800 dark:text-foreground leading-none mb-1">
                {kpi.value}
              </div>
              {kpi.sub && <div className="text-xs font-bold text-muted-foreground">{kpi.sub}</div>}
              <div className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground mt-0.5">
                {kpi.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ELO Distribution Bar Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-black text-muted-foreground dark:text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> ELO Distribution
        </h3>
        <div className="space-y-2.5">
          {stats.eloDistribution.map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-24 text-xs font-bold text-muted-foreground dark:text-muted-foreground shrink-0">
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
              <span className="w-6 text-xs font-black text-muted-foreground dark:text-slate-300 text-right shrink-0">
                {band.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
