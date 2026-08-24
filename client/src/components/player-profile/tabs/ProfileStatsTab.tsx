import { motion } from "framer-motion";
import { Target, Users, HelpCircle } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ProfileStatsTabProps {
  player: any;
  liveMatches: any[];
  allPlayers: any[];
  id: string;
  setLocation: (url: string) => void;
  AchievementBadges: any;
  PerformanceTrends: any;
  WrappedCard: any;
  PlayerAnalyticsWidget: any;
  ActivityHeatmap: any;
}

export function ProfileStatsTabLeft({
  player,
  liveMatches,
  allPlayers,
  id,
  AchievementBadges,
  PerformanceTrends,
  WrappedCard,
  PlayerAnalyticsWidget,
  ActivityHeatmap,
}: ProfileStatsTabProps) {
  return (
    <motion.section variants={itemVariants} className="space-y-6 md:space-y-6">
      <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground dark:text-foreground/45 flex items-center gap-2 mb-6">
          <Target className="w-4 h-4 text-primary dark:text-primary" /> Player
          Type Analysis
          <div className="group relative inline-flex ml-auto md:ml-2">
            <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-200 transition-colors cursor-help" />
            
            {/* Tooltip positioned to drop DOWNWARD so it doesn't get clipped by the container's overflow-hidden */}
            <div className="absolute right-0 md:left-1/2 md:-translate-x-1/2 top-full mt-2 w-64 bg-slate-900 text-on-accent text-[10px] sm:text-xs p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case tracking-normal font-medium leading-relaxed">
              <ul className="space-y-1">
                <li><strong className="text-primary">Singles/Doubles/Mixed:</strong> Win % in each format</li>
                <li><strong className="text-primary">Activity:</strong> Based on total matches logged</li>
                <li><strong className="text-primary">Synergy:</strong> Overall rating in team formats</li>
              </ul>
            </div>
          </div>
        </h2>
        <div className="h-72 w-full" aria-label="Player strengths radar chart" role="img">
          {(() => {
            const sRecord = player.singles_record || "0W - 0L";
            const dRecord = player.doubles_record || "0W - 0L";
            const xdRecord = player.mixed_record || "0W - 0L";
            const parseWinPct = (r: string) => {
              const m = r.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
              if (!m) return 0;
              const w = +m[1];
              const l = +m[2];
              return w + l ? Math.round((w / (w + l)) * 100) : 0;
            };
            const data = [
              { subject: "Singles", A: parseWinPct(sRecord) || 20, fullMark: 100 },
              { subject: "Doubles", A: parseWinPct(dRecord) || 20, fullMark: 100 },
              { subject: "Mixed", A: parseWinPct(xdRecord) || 20, fullMark: 100 },
              {
                subject: "Activity",
                A: Math.min(100, Math.max(20, liveMatches.length * 5)),
                fullMark: 100,
              },
              {
                subject: "Synergy",
                A: (player.doubles_elo || 1200) > 1300 ? 90 : 50,
                fullMark: 100,
              },
            ];
            return (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                  <defs>
                    <linearGradient id="colorRadar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" className="dark:stroke-slate-700/60" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#94a3b8", fontSize: 13, fontWeight: 700 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Performance"
                    dataKey="A"
                    stroke="#10b981"
                    strokeWidth={4}
                    fill="url(#colorRadar)"
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(30, 41, 59, 0.8)",
                      borderRadius: "12px",
                      backdropFilter: "blur(8px)",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                    }}
                    itemStyle={{ color: "#10b981", fontWeight: "black", fontSize: "16px" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "4px" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      <AchievementBadges
        matches={liveMatches}
        playerId={id}
        elo={player.elo_rating ?? 1200}
      />
      <PerformanceTrends matches={liveMatches} playerId={id} />
      <WrappedCard
        playerName={player.fullName}
        avatarUrl={player.avatar}
        elo={player.elo_rating ?? 1200}
        matches={liveMatches}
        playerId={id}
      />
      <PlayerAnalyticsWidget
        matches={liveMatches}
        playerId={id}
        playerElo={player.elo_rating ?? 1200}
        allPlayers={allPlayers}
      />
      <ActivityHeatmap
        matches={liveMatches.filter((m) => m.status === "confirmed" || m.status === "completed")}
      />
    </motion.section>
  );
}

export function ProfileStatsTabRight({
  liveMatches,
  id,
  allPlayers,
  DoublesSynergyWidget,
}: {
  liveMatches: any[];
  id: string;
  allPlayers: any[];
  DoublesSynergyWidget: any;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DoublesSynergyWidget
        matches={liveMatches.filter((m) => m.status === "confirmed" || m.status === "completed")}
        playerId={id}
        allPlayers={allPlayers}
      />
    </div>
  );
}
