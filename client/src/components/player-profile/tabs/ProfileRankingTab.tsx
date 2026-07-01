import { motion } from "framer-motion";
import { InfoModal } from "@/components/InfoModal";
import { TrendingUp, Trophy, Info } from "lucide-react";
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
  eloRank?: any;
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
  eloRank,
}: ProfileRankingTabProps) {
  const peakElo = eloHistoryData.length > 0 ? Math.max(...eloHistoryData.map(d => d.elo)) : player.elo_rating || 1200;

  const genderPrefix = eloRank?.targetGender === "female" ? "W" : (eloRank?.targetGender === "male" ? "M" : "");
  const singlesLabel = genderPrefix ? `${genderPrefix}S Rank` : "Singles Rank";
  const doublesLabel = genderPrefix ? `${genderPrefix}D Rank` : "Doubles Rank";

  return (
    <motion.section variants={itemVariants} className="space-y-6 md:space-y-6">
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

      {/* Format Rankings */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 flex flex-col shadow-lg shadow-amber-500/20 text-foreground relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-20">
            <Trophy className="w-20 h-20" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 mb-1 relative z-10">Overall Rank</span>
          <span className="text-3xl font-black relative z-10">{eloRank?.overall ? `#${eloRank.overall}` : "N/A"}</span>
          <span className="text-xs font-bold text-foreground/90 mt-1 relative z-10">{player.elo_rating || 1200} ELO</span>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">{singlesLabel}</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.singles ? `#${eloRank.singles}` : "N/A"}</span>
          <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground mt-1">{player.singles_elo || 1200} ELO</span>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">{doublesLabel}</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.doubles ? `#${eloRank.doubles}` : "N/A"}</span>
          <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground mt-1">{player.doubles_elo || 1200} ELO</span>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-1">Mixed Rank</span>
          <span className="text-2xl font-black text-slate-800 dark:text-foreground">{eloRank?.mixed ? `#${eloRank.mixed}` : "N/A"}</span>
          <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground mt-1">{player.mixed_elo || 1200} ELO</span>
        </div>

        <div className="bg-slate-900 dark:bg-black/50 rounded-2xl p-4 flex flex-col border border-slate-800 dark:border-white/10 text-foreground col-span-2 md:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Peak ELO</span>
          <span className="text-2xl font-black text-foreground">{peakElo}</span>
          <span className="text-xs font-bold text-primary mt-1">Career Best</span>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-white/8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground dark:text-foreground/45 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" /> ELO Progression
            </h3>
            <InfoModal
              title="ELO PROGRESSION"
              items={[
                { badge: "GRAPH", title: "Visual History", desc: "Tracks your global ELO over time, recalculating after every confirmed match." },
                { badge: "CATEGORIES", title: "Category Breakdown", desc: "Toggle between Global, MS, MD, etc. to see your specific ratings in each format." }
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEloAudit(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-muted-foreground dark:hover:bg-slate-700 transition"
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
                      : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"
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
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-bold text-muted-foreground dark:text-slate-300">
              No Data Available
            </h4>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1 max-w-xs">
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
          <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 text-center">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-foreground/10 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-muted-foreground dark:text-foreground/40">
              Not Enough Data
            </h3>
            <p className="text-xs text-muted-foreground dark:text-foreground/20 mt-1">
              Play more matches to unlock ranking analytics.
            </p>
          </div>
        )}
    </motion.section>
  );
}
