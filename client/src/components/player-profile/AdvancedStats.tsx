import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

export interface TimeOfDayStat {
  period: string; // "Morning", "Afternoon", "Evening", "Night"
  wins: number;
  total: number;
  winPct: number;
}

export interface PlaystyleStat {
  trait: string; // "vs Left-Handed", "vs Right-Handed", "vs Male", "vs Female"
  wins: number;
  total: number;
  winPct: number;
}

interface AdvancedStatsProps {
  timeStats: TimeOfDayStat[];
  playstyleStats: PlaystyleStat[];
}

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-sm">
        <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">{label}</p>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-2xl font-black text-white leading-none">{data.winPct}%</span>
          <span className="text-xs text-slate-400 font-medium mb-0.5">Win Rate</span>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          {data.wins} Wins / {data.total} Matches
        </p>
      </div>
    );
  }
  return null;
};

export function AdvancedStats({ timeStats, playstyleStats }: AdvancedStatsProps) {
  // Filter out empty data
  const validTimeStats = timeStats.filter(t => t.total > 0);
  const validPlaystyleStats = playstyleStats.filter(p => p.total > 0);

  const renderBarChart = (data: any[], color: string, title: string) => (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-sm dark:shadow-none">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/45 flex items-center gap-2 mb-6">
        {title}
      </h3>
      
      {data.length > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.2} />
              <XAxis 
                dataKey={data[0]?.period ? "period" : "trait"} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 10 }}
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
              <Bar dataKey="winPct" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.winPct >= 50 ? color : '#f43f5e'} opacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center">
          <span className="text-slate-500 text-sm italic">Not enough data to analyze.</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {renderBarChart(validTimeStats, '#8b5cf6', 'Performance By Time')}
      {renderBarChart(validPlaystyleStats, '#0ea5e9', 'Performance By Opponent')}
    </div>
  );
}
