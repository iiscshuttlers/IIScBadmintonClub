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
  DoublesSynergyWidget: any;
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
  DoublesSynergyWidget,
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
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                  <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Performance"
                    dataKey="A"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="#10b981"
                    fillOpacity={0.4}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--tw-colors-slate-900)",
                      borderColor: "var(--tw-colors-slate-800)",
                      borderRadius: "12px",
                    }}
                    itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      <DoublesSynergyWidget
        matches={liveMatches.filter((m) => m.status === "confirmed")}
        playerId={id}
        allPlayers={allPlayers}
      />
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
        matches={liveMatches.filter((m) => m.status === "confirmed")}
      />
    </motion.section>
  );
}

export function ProfileStatsTabRight({
  player,
  setLocation,
}: {
  player: any;
  setLocation: (url: string) => void;
}) {
  if (!player.frequentPartners || player.frequentPartners.length === 0) return null;

  return (
    <motion.section
      variants={itemVariants}
      className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 to-primary" />
      <h2 className="text-[10px] font-black text-muted-foreground dark:text-foreground/35 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-amber-400" /> Frequent Partners
      </h2>
      <div className="space-y-2">
        {player.frequentPartners.map((p: any, idx: number) => (
          <button
            key={idx}
            onClick={() => p.id && setLocation(`/player/${p.id}`)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-white/4 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 border border-slate-300 dark:border-white/7 transition-all group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a3a7a] to-[#0f2347] border border-amber-500/30 flex items-center justify-center text-amber-300 font-black text-xs shrink-0">
                {p.name
                  .split(" ")
                  .map((s: string) => s[0])
                  .join("")}
              </div>
              <div className="truncate">
                <div className="text-sm font-bold text-muted-foreground dark:text-foreground/90 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {p.name}
                </div>
                <div className="text-xs text-muted-foreground dark:text-foreground/40">
                  {p.matchesTogether} matches
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-xs font-black text-primary">
                {p.winRate}%
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground dark:text-foreground/30">
                Win Rate
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.section>
  );
}
