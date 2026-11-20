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
  { label: "Bronze", min: 0, max: 999, color: "bg-secondary" },
  { label: "Silver", min: 1000, max: 1199, color: "bg-muted-foreground" },
  { label: "Gold", min: 1200, max: 1399, color: "bg-warning" },
  { label: "Platinum", min: 1400, max: 1599, color: "bg-accent" },
  { label: "Diamond", min: 1600, max: 1799, color: "bg-info" },
  { label: "Grandmaster", min: 1800, max: 99999, color: "bg-danger" },
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
          <div key={i} className="h-28 rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const kpis = [
    { label: "Approved Players", value: stats.approvedPlayers, icon: Users, color: "text-primary", bg: "bg-primary/20" },
    { label: "Pending Approval", value: stats.pendingPlayers, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", alert: stats.pendingPlayers > 0 },
    { label: "Avg ELO", value: stats.avgElo, icon: BarChart3, color: "text-team", bg: "bg-team/10" },
    { label: "Top Player", value: stats.topPlayer?.name?.split(" ")[0] ?? "—", sub: stats.topPlayer ? `${stats.topPlayer.elo} ELO` : "", icon: Zap, color: "text-warning", bg: "bg-warning/10" },
    { label: "DB Latency", value: `${stats.dbLatency}ms`, icon: Database, color: stats.dbLatency > 500 ? "text-danger" : "text-info", bg: stats.dbLatency > 500 ? "bg-danger/10" : "bg-info/10" },
  ];

  const maxCount = Math.max(...stats.eloDistribution.map((d) => d.count), 1);



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
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
              className={`rounded-2xl p-4 border ${kpi.alert ? "border-danger/30 bg-danger/10" : `border-border ${kpi.bg}`}`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`w-5 h-5 ${kpi.color}`} />
                {kpi.alert && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
              </div>
              <div className="text-2xl font-black text-foreground leading-none mb-1">
                {kpi.value}
              </div>
              {kpi.sub && <div className="text-xs font-bold text-muted-foreground">{kpi.sub}</div>}
              <div className="text-xs font-semibold text-muted-foreground mt-0.5">
                {kpi.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ELO Distribution Bar Chart */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> ELO Distribution
        </h3>
        <div className="space-y-2.5">
          {stats.eloDistribution.map((band) => (
            <div key={band.label} className="flex items-center gap-3">
              <span className="w-24 text-xs font-bold text-muted-foreground shrink-0">
                {band.label}
              </span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(band.count / maxCount) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full ${band.color} opacity-80`}
                />
              </div>
              <span className="w-6 text-xs font-black text-soft text-right shrink-0">
                {band.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
