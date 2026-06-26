import { Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { lazy, Suspense } from "react";

const ResponsiveContainer = lazy(() => import("recharts").then(m => ({ default: m.ResponsiveContainer })));
const LineChart = lazy(() => import("recharts").then(m => ({ default: m.LineChart })));
const Line = lazy(() => import("recharts").then(m => ({ default: m.Line })));
const XAxis = lazy(() => import("recharts").then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import("recharts").then(m => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import("recharts").then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import("recharts").then(m => ({ default: m.Tooltip })));
const PieChart = lazy(() => import("recharts").then(m => ({ default: m.PieChart })));
const Pie = lazy(() => import("recharts").then(m => ({ default: m.Pie })));
const Cell = lazy(() => import("recharts").then(m => ({ default: m.Cell })));
const Radar = lazy(() => import("recharts").then(m => ({ default: m.Radar })));
const RadarChart = lazy(() => import("recharts").then(m => ({ default: m.RadarChart })));
const PolarGrid = lazy(() => import("recharts").then(m => ({ default: m.PolarGrid })));
const PolarAngleAxis = lazy(() => import("recharts").then(m => ({ default: m.PolarAngleAxis })));
const PolarRadiusAxis = lazy(() => import("recharts").then(m => ({ default: m.PolarRadiusAxis })));
const AreaChart = lazy(() => import("recharts").then(m => ({ default: m.AreaChart })));
const Area = lazy(() => import("recharts").then(m => ({ default: m.Area })));

export const CircularProgress = ({
  value,
  size = 72,
  stroke = 7,
}: {
  value: number;
  size?: number;
  stroke?: number;
}) => {
  const radius = (size - stroke) / 2;
  const c = radius * 2 * Math.PI;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-slate-200 dark:text-slate-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size <= 48 ? "text-[10px]" : size <= 64 ? "text-sm" : "text-lg"} font-black text-slate-900 dark:text-white`}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
};

export const FormPill = ({
  result,
  index,
}: {
  result: "W" | "L";
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.4 + index * 0.07, type: "spring", stiffness: 220 }}
    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-md
      ${
        result === "W"
          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/40"
          : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/40"
      }`}
  >
    {result}
  </motion.div>
);

export const CategoryBar = ({
  label,
  wins,
  losses,
  color,
}: {
  label: string;
  wins: number;
  losses: number;
  color: string;
}) => {
  const total = wins + losses;
  const winPct = total ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({total} matches)
          </span>
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {wins}
          <span className="text-slate-400 font-normal">W</span> – {losses}
          <span className="text-slate-400 font-normal">L</span>
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${winPct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - winPct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
          className="h-full bg-slate-300 dark:bg-slate-700"
        />
      </div>
    </div>
  );
};

export const KPI = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) => (
  <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
    <div
      className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${accent}`}
    />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent} bg-opacity-15`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {sub}
        </div>
      )}
    </div>
  </div>
);

export const Badges = ({
  matches,
  playerId,
}: {
  matches: any[];
  playerId: string;
}) => {
  const [badges, setBadges] = useState<
    { id: string; name: string; desc: string; icon: string; color: string }[]
  >([]);

  useEffect(() => {
    const earned = [];

    // Giant Slayer: Won against someone with 150+ more ELO
    const giantSlayer = matches.some((m) => {
      if (m.winner_id !== playerId) return false;
      const opponent = m.player1_id === playerId ? m.player2 : m.player1;
      const myElo =
        m.player1_id === playerId
          ? m.player1?.elo_rating
          : m.player2?.elo_rating;
      return opponent?.elo_rating - myElo >= 150;
    });
    if (giantSlayer)
      earned.push({
        id: "giant_slayer",
        name: "Giant Slayer",
        desc: "Beat an opponent 150+ ELO higher",
        icon: "⚔️",
        color: "from-amber-400 to-orange-600",
      });

    // Clean Sweep: Win where opponent score < 5
    const cleanSweep = matches.some((m) => {
      if (m.winner_id !== playerId) return false;
      // Parse match_score JSON to see if any set had opponent score < 5
      if (m.match_score && Array.isArray(m.match_score)) {
        return m.match_score.some((set: any) => {
          const myScore =
            m.winner_id === m.player1_id ? set.p1_score : set.p2_score;
          const oppScore =
            m.winner_id === m.player1_id ? set.p2_score : set.p1_score;
          return myScore > oppScore && oppScore < 5;
        });
      }
      return false;
    });
    if (cleanSweep)
      earned.push({
        id: "clean_sweep",
        name: "Clean Sweep",
        desc: "Kept an opponent under 5 points",
        icon: "??",
        color: "from-cyan-400 to-blue-600",
      });

    // Night Owl: Played a match between 00:00 and 05:00
    const nightOwl = matches.some((m) => {
      const h = new Date(m.created_at).getHours();
      return h >= 0 && h < 5;
    });
    if (nightOwl)
      earned.push({
        id: "night_owl",
        name: "Night Owl",
        desc: "Played past midnight",
        icon: "🦉",
        color: "from-indigo-400 to-purple-600",
      });

    // Early Bird: Played a match between 05:00 and 08:00
    const earlyBird = matches.some((m) => {
      const h = new Date(m.created_at).getHours();
      return h >= 5 && h < 8;
    });
    if (earlyBird)
      earned.push({
        id: "early_bird",
        name: "Early Bird",
        desc: "Played before 8 AM",
        icon: "🌅",
        color: "from-sky-400 to-blue-600",
      });

    // Ironman: 5 consecutive days of logged matches
    const dates = [
      ...new Set(matches.map((m) => new Date(m.created_at).toDateString())),
    ]
      .map((d) => new Date(d).getTime())
      .sort((a, b) => b - a);

    let maxConsecutive = 1;
    let currentConsecutive = 1;
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i] - dates[i + 1] <= oneDay + 1000 * 60 * 60) {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutive)
          maxConsecutive = currentConsecutive;
      } else {
        currentConsecutive = 1;
      }
    }

    if (maxConsecutive >= 5)
      earned.push({
        id: "ironman",
        name: "Ironman",
        desc: "5 consecutive days of logged matches",
        icon: "??",
        color: "from-rose-400 to-red-600",
      });

    // Streaker: current or historical streak >= 5 (simplification: if they won 5 of last 5)
    let streak = 0;
    let maxStreak = 0;
    matches
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
      .forEach((m) => {
        if (m.winner_id === playerId) streak++;
        else streak = 0;
        maxStreak = Math.max(maxStreak, streak);
      });
    if (maxStreak >= 5)
      earned.push({
        id: "streaker",
        name: "Streaker",
        desc: "Won 5 matches in a row",
        icon: "🔥",
        color: "from-red-500 to-rose-600",
      });

    setBadges(earned);
  }, [matches, playerId]);

  if (badges.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
        Achievements
      </h3>
      <div className="flex flex-wrap gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-br ${b.color} text-white shadow-md cursor-help`}
            title={b.desc}
          >
            <span className="text-xl">{b.icon}</span>
            <div className="flex flex-col">
              <span className="text-xs font-black leading-tight">{b.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ActivityHeatmap = ({ matches }: { matches: any[] }) => {
  const [heatmapData, setHeatmapData] = useState<
    { date: string; count: number; dayMatches: any[] }[]
  >([]);
  const [selectedDateData, setSelectedDateData] = useState<{ date: string; count: number; dayMatches: any[] } | null>(null);

  useEffect(() => {
    const counts: Record<string, any[]> = {};
    matches.forEach((m) => {
      const dateStr = new Date(m.created_at).toISOString().split("T")[0];
      if (!counts[dateStr]) counts[dateStr] = [];
      counts[dateStr].push(m);
    });
    const data = Object.keys(counts).map((date) => ({
      date,
      count: counts[date].length,
      dayMatches: counts[date].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }));
    setHeatmapData(data);
  }, [matches]);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8 overflow-hidden">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex justify-between items-center">
        <span>Activity Heatmap</span>
        {selectedDateData && (
          <button onClick={() => setSelectedDateData(null)} className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Clear Selection
          </button>
        )}
      </h3>
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div style={{ minWidth: "600px" }}>
          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={heatmapData}
            onClick={(value: any) => {
              if (value && value.count > 0) {
                setSelectedDateData(value);
              } else {
                setSelectedDateData(null);
              }
            }}
            classForValue={(value) => {
              let classes = "";
              if (!value || value.count === 0) {
                classes = "color-empty";
              } else if (value.count >= 4) {
                classes = "color-scale-4";
              } else {
                classes = `color-scale-${value.count}`;
              }
              if (value && selectedDateData && value.date === selectedDateData.date) {
                classes += " ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-800";
              }
              return classes;
            }}
            showWeekdayLabels={true}
            titleForValue={(value) => {
              if (!value) return "No matches";
              return `${value.count} match${value.count !== 1 ? "es" : ""} on ${value.date}`;
            }}
          />
        </div>
      </div>

      {selectedDateData && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700"
        >
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
            <span>Matches on {new Date(selectedDateData.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-xs">{selectedDateData.count} Total</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {selectedDateData.dayMatches.map((match: any) => {
              // Parse out the format, score, and players
              const format = match.category === "Singles" ? "Singles" : (match.team1_partner_id ? (match.player1?.gender !== match.partner1?.gender ? "Mixed Doubles" : "Doubles") : "Doubles");
              let displayScore = match.score || "N/A";
              if (displayScore.includes(" | ")) displayScore = displayScore.split(" | ")[0];
              
              return (
                <div key={match.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                      {format}
                    </span>
                    <span className="text-[10px] font-black text-slate-400">
                      {new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between items-center">
                      <div className="truncate flex-1">
                        {match.player1?.full_name?.split(' ')[0]} {match.partner1 ? `& ${match.partner1?.full_name?.split(' ')[0]}` : ''}
                      </div>
                      {match.winner_id === match.player1_id && <span className="text-amber-500 ml-2 text-xs">👑</span>}
                    </div>
                    <div className="flex justify-between items-center text-xs font-black text-slate-400 my-0.5">
                      <span className="mx-auto bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{displayScore}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="truncate flex-1">
                        {match.player2?.full_name?.split(' ')[0]} {match.partner2 ? `& ${match.partner2?.full_name?.split(' ')[0]}` : ''}
                      </div>
                      {match.winner_id === match.player2_id && <span className="text-amber-500 ml-2 text-xs">👑</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <style>{`
        .react-calendar-heatmap .color-empty { fill: rgba(148, 163, 184, 0.1); }
        .react-calendar-heatmap .color-scale-1 { fill: #6ee7b7; }
        .react-calendar-heatmap .color-scale-2 { fill: #34d399; }
        .react-calendar-heatmap .color-scale-3 { fill: #10b981; }
        .react-calendar-heatmap .color-scale-4 { fill: #059669; }
        .react-calendar-heatmap rect { rx: 2; ry: 2; transition: all 0.2s; cursor: pointer; }
        .react-calendar-heatmap rect:hover { stroke: #000; stroke-width: 1px; opacity: 0.8; }
        .dark .react-calendar-heatmap .color-empty { fill: rgba(30, 41, 59, 0.5); }
        .dark .react-calendar-heatmap rect:hover { stroke: #fff; }
        .react-calendar-heatmap text { fill: #94a3b8; font-size: 8px; }
      `}</style>
    </div>
  );
};

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070d1a] selection:bg-emerald-500/30 font-sans">
      <div
        className="relative overflow-hidden bg-slate-950"
        style={{ minHeight: "88vh" }}
      >
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-20 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[60vh]">
            <div className="flex flex-col justify-center space-y-6">
              <div className="h-6 w-32 bg-slate-800 rounded-full animate-pulse" />
              <div className="space-y-4">
                <div className="h-20 sm:h-24 w-3/4 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-20 sm:h-24 w-2/3 bg-slate-800 rounded-2xl animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-32 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-8 w-20 bg-slate-800 rounded-lg animate-pulse" />
              </div>
              <div className="flex items-stretch gap-2 mt-4">
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
                <div className="h-24 w-24 bg-slate-800 rounded-2xl animate-pulse" />
              </div>
            </div>
            <div className="flex justify-center lg:justify-end items-center">
              <div className="w-[280px] h-[380px] sm:w-[360px] sm:h-[480px] bg-slate-800 rounded-[4rem] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HeadToHeadWidget = ({
  currentUser,
  targetPlayer,
  matches,
}: {
  currentUser: any;
  targetPlayer: any;
  matches: any[];
}) => {
  if (!currentUser || !targetPlayer || currentUser.id === targetPlayer.id)
    return null;

  const h2hMatches = matches.filter(
    (m) =>
      (m.player1_id === currentUser.id && m.player2_id === targetPlayer.id) ||
      (m.player2_id === currentUser.id && m.player1_id === targetPlayer.id),
  );

  if (h2hMatches.length === 0) return null;

  let wins = 0;
  let losses = 0;
  h2hMatches.forEach((m) => {
    if (m.match_winner_id === currentUser.id) wins++;
    else if (m.match_winner_id === targetPlayer.id) losses++;
  });

  const winPct = Math.round((wins / (wins + losses)) * 100) || 0;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
        ?? HEAD-TO-HEAD
      </h3>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xs font-bold text-slate-400 mb-1">YOU</div>
            <div className="text-3xl font-black text-emerald-500">{wins}</div>
          </div>
          <div className="text-xl font-black text-slate-300 dark:text-slate-600">
            -
          </div>
          <div className="text-center">
            <div className="text-xs font-bold text-slate-400 mb-1">THEM</div>
            <div className="text-3xl font-black text-rose-500">{losses}</div>
          </div>
        </div>
        <div className="flex-1 w-full max-w-xs">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-emerald-500">{winPct}% Win Rate</span>
            <span className="text-slate-400">{h2hMatches.length} Matches</span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${winPct}%` }}
            />
            <div
              className="h-full bg-rose-500"
              style={{ width: `${100 - winPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const DoublesSynergyWidget = ({
  matches,
  playerId,
  allPlayers,
}: {
  matches: any[];
  playerId: string;
  allPlayers: any[];
}) => {
  const synergy = useMemo(() => {
    const stats: Record<string, { wins: number; total: number; name: string }> =
      {};

    matches.forEach((m) => {
      // Determine if I played doubles and who my partner was
      let partnerId = null;
      let myTeamWon = false;

      if (m.player1_id === playerId && m.team1_partner_id) {
        partnerId = m.team1_partner_id;
        myTeamWon = m.match_winner_id === m.player1_id;
      } else if (m.team1_partner_id === playerId) {
        partnerId = m.player1_id;
        myTeamWon = m.match_winner_id === m.player1_id;
      } else if (m.player2_id === playerId && m.team2_partner_id) {
        partnerId = m.team2_partner_id;
        myTeamWon = m.match_winner_id === m.player2_id;
      } else if (m.team2_partner_id === playerId) {
        partnerId = m.player2_id;
        myTeamWon = m.match_winner_id === m.player2_id;
      }

      if (partnerId) {
        if (!stats[partnerId]) {
          const pName =
            allPlayers?.find((p) => p.id === partnerId)?.full_name ||
            "Unknown Partner";
          stats[partnerId] = { wins: 0, total: 0, name: pName };
        }
        stats[partnerId].total++;
        if (myTeamWon) stats[partnerId].wins++;
      }
    });

    const arr = Object.entries(stats).map(([id, s]) => ({
      id,
      ...s,
      winPct: s.wins / s.total,
    }));
    return arr
      .sort((a, b) => b.winPct - a.winPct || b.total - a.total)
      .filter((x) => x.total >= 3);
  }, [matches, playerId, allPlayers]);

  if (synergy.length === 0) return null;

  const bestPartner = synergy[0];

  return (
    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 rounded-3xl p-5 border border-teal-100 dark:border-teal-800/50 shadow-sm relative overflow-hidden mt-6">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Users className="w-24 h-24 text-teal-500" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-lg">
          <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-teal-900 dark:text-teal-300">
          Best Doubles Partner
        </h3>
      </div>

      <div className="relative z-10">
        <div className="text-xl font-black text-teal-700 dark:text-teal-300 mb-1">
          {bestPartner.name}
        </div>
        <div className="flex items-end gap-2">
          <div className="text-3xl font-black text-teal-600 dark:text-teal-400">
            {Math.round(bestPartner.winPct * 100)}%{" "}
            <span className="text-sm uppercase tracking-widest text-teal-500/70">
              Win Rate
            </span>
          </div>
        </div>
        <div className="text-xs font-bold text-teal-600/70 dark:text-teal-400/70 mt-2">
          {bestPartner.wins} Wins in {bestPartner.total} Matches together
        </div>
      </div>
    </div>
  );
};
