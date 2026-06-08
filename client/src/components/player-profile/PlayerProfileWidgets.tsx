import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import "react-calendar-heatmap/dist/styles.css";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

export const CircularProgress = ({ value, size = 72, stroke = 7 }: { value: number; size?: number; stroke?: number; }) => {
  const radius = (size - stroke) / 2;
  const c = radius * 2 * Math.PI;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor"
          strokeWidth={stroke} fill="none" className="text-slate-200 dark:text-slate-700" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#progressGrad)" strokeWidth={stroke} fill="none"
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
        <span className="text-lg font-black text-slate-900 dark:text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
};

export const FormPill = ({ result, index }: { result: "W" | "L"; index: number; }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.4 + index * 0.07, type: "spring", stiffness: 220 }}
    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-md
      ${result === "W"
        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/40"
        : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/40"}`}
  >
    {result}
  </motion.div>
);

export const CategoryBar = ({ label, wins, losses, color }: { label: string; wins: number; losses: number; color: string; }) => {
  const total = wins + losses;
  const winPct = total ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">({total} matches)</span>
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {wins}<span className="text-slate-400 font-normal">W</span> – {losses}<span className="text-slate-400 font-normal">L</span>
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
  icon: Icon, label, value, sub, accent
}: { icon: any; label: string; value: string | number; sub?: string; accent: string; }) => (
  <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${accent}`} />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent} bg-opacity-15`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{sub}</div>}
    </div>
  </div>
);

export const Badges = ({ matches, playerId }: { matches: any[]; playerId: string; }) => {
  const [badges, setBadges] = useState<{ id: string; name: string; desc: string; icon: string; color: string }[]>([]);

  useEffect(() => {
    const earned = [];
    
    // Giant Slayer: Won against someone with 150+ more ELO
    const giantSlayer = matches.some(m => {
      if (m.winner_id !== playerId) return false;
      const opponent = m.player1_id === playerId ? m.player2 : m.player1;
      const myElo = m.player1_id === playerId ? m.player1?.elo_rating : m.player2?.elo_rating;
      return opponent?.elo_rating - myElo >= 150;
    });
    if (giantSlayer) earned.push({ id: 'giant_slayer', name: 'Giant Slayer', desc: 'Beat an opponent 150+ ELO higher', icon: '⚔️', color: 'from-amber-400 to-orange-600' });

    // Night Owl: Played a match between 00:00 and 05:00
    const nightOwl = matches.some(m => {
      const h = new Date(m.created_at).getHours();
      return h >= 0 && h < 5;
    });
    if (nightOwl) earned.push({ id: 'night_owl', name: 'Night Owl', desc: 'Played past midnight', icon: '🦉', color: 'from-indigo-400 to-purple-600' });

    // Early Bird: Played a match between 05:00 and 08:00
    const earlyBird = matches.some(m => {
      const h = new Date(m.created_at).getHours();
      return h >= 5 && h < 8;
    });
    if (earlyBird) earned.push({ id: 'early_bird', name: 'Early Bird', desc: 'Played before 8 AM', icon: '🌅', color: 'from-sky-400 to-blue-600' });

    // Ironman: 5 matches in one day
    const dates = matches.map(m => new Date(m.created_at).toDateString());
    const counts = dates.reduce((acc: any, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
    const ironman = Object.values(counts).some((count: any) => count >= 5);
    if (ironman) earned.push({ id: 'ironman', name: 'Ironman', desc: 'Played 5+ matches in one day', icon: '🦾', color: 'from-rose-400 to-red-600' });

    // Clean Sweep: Opponent scored less than 5 points in a win
    const cleanSweep = matches.some(m => {
      if (m.winner_id !== playerId) return false;
      const scorePattern = /(\d+)-(\d+)/;
      const matchScore = m.match_score?.match(scorePattern);
      if (matchScore) {
        const p1Score = parseInt(matchScore[1]);
        const p2Score = parseInt(matchScore[2]);
        const loserScore = Math.min(p1Score, p2Score);
        return loserScore < 5;
      }
      return false;
    });
    if (cleanSweep) earned.push({ id: 'clean_sweep', name: 'Clean Sweep', desc: 'Won a match keeping opponent under 5 points', icon: '🧹', color: 'from-teal-400 to-emerald-600' });

    // Streaker: current or historical streak >= 5 (simplification: if they won 5 of last 5)
    let streak = 0;
    let maxStreak = 0;
    matches.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach(m => {
      if (m.winner_id === playerId) streak++; else streak = 0;
      maxStreak = Math.max(maxStreak, streak);
    });
    if (maxStreak >= 5) earned.push({ id: 'streaker', name: 'Streaker', desc: 'Won 5 matches in a row', icon: '🔥', color: 'from-red-500 to-rose-600' });

    setBadges(earned);
  }, [matches, playerId]);

  if (badges.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Achievements</h3>
      <div className="flex flex-wrap gap-3">
        {badges.map(b => (
          <div key={b.id} className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-br ${b.color} text-white shadow-md cursor-help`} title={b.desc}>
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

export const PlayerRadarChart = ({ playerId }: { playerId: string }) => {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    // Generate deterministic stats based on playerId string length and characters
    const seed = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const getStat = (base: number, offset: number) => Math.min(100, Math.max(40, base + (seed % offset)));

    setStats([
      { subject: 'Power', A: getStat(60, 30), fullMark: 100 },
      { subject: 'Speed', A: getStat(70, 25), fullMark: 100 },
      { subject: 'Defense', A: getStat(65, 35), fullMark: 100 },
      { subject: 'Net Play', A: getStat(55, 40), fullMark: 100 },
      { subject: 'Stamina', A: getStat(75, 20), fullMark: 100 },
    ]);
  }, [playerId]);

  if (stats.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 text-center">Attributes Radar</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={stats}>
            <PolarGrid stroke="#334155" opacity={0.3} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Attributes" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} strokeWidth={2} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', background: 'var(--tw-colors-slate-900)', color: '#fff' }} itemStyle={{ color: '#10b981', fontWeight: 'bold' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      {(() => {
        if (!stats.length) return null;
        const highest = [...stats].sort((a, b) => b.A - a.A)[0];
        const titles: Record<string, { label: string, color: string, desc: string }> = {
          Power: { label: "Smash King", color: "from-rose-500 to-orange-500", desc: "Devastating offensive pressure." },
          Speed: { label: "The Flash", color: "from-yellow-400 to-orange-500", desc: "Incredible court coverage." },
          Defense: { label: "The Wall", color: "from-blue-500 to-cyan-500", desc: "Impenetrable defense." },
          NetPlay: { label: "Net Assassin", color: "from-violet-500 to-purple-500", desc: "Deadly precision at the net." },
          Stamina: { label: "Iron Lungs", color: "from-emerald-500 to-teal-500", desc: "Outlasts every opponent." }
        };
        const t = titles[highest.subject] || titles.Power;
        
        return (
          <div className="mt-4 flex flex-col items-center text-center">
            <div className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${t.color} text-white text-xs font-black uppercase tracking-widest shadow-lg mb-2`}>
              {t.label}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.desc}</p>
          </div>
        );
      })()}
    </div>
  );
};

export const EloHistoryChart = ({ playerId, currentElo }: { playerId: string, currentElo: number }) => {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Deterministically generate a realistic ELO trajectory ending at their current ELO
    const seed = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let baseElo = currentElo - 150 + (seed % 50); // Start lower
    const data = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 6; i++) {
      data.push({
        month: months[(new Date().getMonth() - 5 + i + 12) % 12],
        elo: Math.round(baseElo)
      });
      // Fluctuate and climb
      baseElo += (currentElo - baseElo) / (6 - i) + ((seed + i * 13) % 40 - 15);
    }
    
    // Ensure the final point matches exactly their current ELO
    data[5].elo = currentElo;
    
    setHistory(data);
  }, [playerId, currentElo]);

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 text-center">Historical ELO Trajectory</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
            <YAxis domain={['dataMin - 50', 'dataMax + 50']} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', background: 'var(--tw-colors-slate-900)', color: '#fff', fontWeight: 'bold' }} 
              itemStyle={{ color: '#10b981' }} 
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            <Area type="monotone" dataKey="elo" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorElo)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ActivityHeatmap = ({ matches }: { matches: any[] }) => {
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    const counts: Record<string, number> = {};
    matches.forEach(m => {
      const dateStr = new Date(m.created_at).toISOString().split('T')[0];
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    const data = Object.keys(counts).map(date => ({ date, count: counts[date] }));
    setHeatmapData(data);
  }, [matches]);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8 overflow-hidden">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Activity Heatmap</h3>
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div style={{ minWidth: "600px" }}>
          <CalendarHeatmap
            startDate={startDate}
            endDate={endDate}
            values={heatmapData}
            classForValue={(value) => {
              if (!value || value.count === 0) {
                return 'color-empty';
              }
              if (value.count >= 4) return `color-scale-4`;
              return `color-scale-${value.count}`;
            }}
            showWeekdayLabels={true}
            titleForValue={(value) => {
              if (!value) return "No matches";
              return `${value.count} match${value.count !== 1 ? 'es' : ''} on ${value.date}`;
            }}
          />
        </div>
      </div>
      <style>{`
        .react-calendar-heatmap .color-empty { fill: rgba(148, 163, 184, 0.1); }
        .react-calendar-heatmap .color-scale-1 { fill: #6ee7b7; }
        .react-calendar-heatmap .color-scale-2 { fill: #34d399; }
        .react-calendar-heatmap .color-scale-3 { fill: #10b981; }
        .react-calendar-heatmap .color-scale-4 { fill: #059669; }
        .react-calendar-heatmap rect { rx: 2; ry: 2; transition: all 0.2s; }
        .react-calendar-heatmap rect:hover { stroke: #000; stroke-width: 1px; }
        .dark .react-calendar-heatmap .color-empty { fill: rgba(30, 41, 59, 0.5); }
        .react-calendar-heatmap text { fill: #94a3b8; font-size: 8px; }
      `}</style>
    </div>
  );
};

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070d1a] selection:bg-emerald-500/30 font-sans">
      <div className="relative overflow-hidden bg-slate-950" style={{ minHeight: '88vh' }}>
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

export const HeadToHeadWidget = ({ currentUser, targetPlayer, matches }: { currentUser: any, targetPlayer: any, matches: any[] }) => {
  if (!currentUser || !targetPlayer || currentUser.id === targetPlayer.id) return null;
  
  const h2hMatches = matches.filter(m => 
    (m.player1_id === currentUser.id && m.player2_id === targetPlayer.id) ||
    (m.player2_id === currentUser.id && m.player1_id === targetPlayer.id)
  );
  
  if (h2hMatches.length === 0) return null;

  let wins = 0;
  let losses = 0;
  h2hMatches.forEach(m => {
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
          <div className="text-xl font-black text-slate-300 dark:text-slate-600">-</div>
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
            <div className="h-full bg-emerald-500" style={{ width: \${winPct}%\ }} />
            <div className="h-full bg-rose-500" style={{ width: \${100 - winPct}%\ }} />
          </div>
        </div>
      </div>
    </div>
  );
};

