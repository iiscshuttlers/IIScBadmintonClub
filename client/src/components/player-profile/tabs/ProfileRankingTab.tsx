import { motion } from "framer-motion";
import { TrendingUp, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ProfileRankingTabProps {
  player: any;
  authSession: any;
  liveMatches: any[];
  eloHistoryData: any[];
  eloChartFilter: "ALL" | "S" | "D" | "XD";
  setEloChartFilter: (v: "ALL" | "S" | "D" | "XD") => void;
  setShowEloAudit: (v: boolean) => void;
  HeadToHeadWidget: any;
  Badges: any;
  id: string;
}

export function ProfileRankingTab({
  player,
  authSession,
  liveMatches,
  eloHistoryData,
  eloChartFilter,
  setEloChartFilter,
  setShowEloAudit,
  HeadToHeadWidget,
  Badges,
  id,
}: ProfileRankingTabProps) {
  return (
    <motion.section variants={itemVariants} className="space-y-6 md:space-y-8">
      {authSession?.user?.id && player.userId && authSession.user.id !== player.userId && (
        <HeadToHeadWidget
          currentUserId={authSession.user.id}
          targetUserId={player.userId}
          targetUserName={player.fullName || ""}
          matches={liveMatches.filter((m) => m.status === "confirmed")}
        />
      )}

      <Badges
        matches={liveMatches.filter((m) => m.status === "confirmed")}
        playerId={id}
      />

      <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-white/8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-white/45 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" /> ELO Progression
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEloAudit(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
            >
              Audit Log
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
              {(["ALL", "S", "D", "XD"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setEloChartFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                    eloChartFilter === filter
                      ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {filter === "ALL" ? "OVR" : filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {eloHistoryData.length > 1 ? (
          <div className="h-64 w-full" aria-label="ELO rating progression chart" role="img">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={eloHistoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  dy={10}
                  minTickGap={30}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 40px -8px rgb(0 0 0 / 0.4)",
                    background: "#0f172a",
                    color: "#f8fafc",
                  }}
                  itemStyle={{ color: "#f59e0b", fontWeight: "bold" }}
                  labelStyle={{
                    color: "#94a3b8",
                    fontSize: "12px",
                    marginBottom: "4px",
                  }}
                  formatter={(value: any, name: string) => [`${value} ELO`, "Rating"]}
                />
                <Line
                  type="monotone"
                  dataKey="elo"
                  stroke="#f59e0b"
                  strokeWidth={4}
                  dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">
              No Data Available
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Play more{" "}
              {eloChartFilter === "S"
                ? "Singles"
                : eloChartFilter === "D"
                ? "Doubles"
                : eloChartFilter === "XD"
                ? "Mixed Doubles"
                : ""}{" "}
              matches to unlock the progression chart.
            </p>
          </div>
        )}
      </div>

      {(!authSession?.user?.id || player.userId === authSession.user.id) &&
        eloHistoryData.length <= 1 &&
        liveMatches.length < 5 && (
          <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-8 border border-slate-200 dark:border-white/8 text-center">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-white/10 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-500 dark:text-white/40">
              Not Enough Data
            </h3>
            <p className="text-xs text-slate-400 dark:text-white/20 mt-1">
              Play more matches to unlock ranking analytics.
            </p>
          </div>
        )}
    </motion.section>
  );
}
