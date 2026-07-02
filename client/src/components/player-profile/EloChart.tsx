import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface EloDataPoint {
  date: string;
  timestamp: number;
  elo: number;
  opponent: string;
  result: "W" | "L";
  eloChange: number;
}

interface EloChartProps {
  playerId: string;
  matches: any[];
  currentElo?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as EloDataPoint;
    const isWin = data.result === "W";
    return (
      <div className="bg-slate-900/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-sm">
        <p className="text-xs text-muted-foreground font-medium mb-1">{data.date}</p>
        <p className="text-sm font-bold text-foreground mb-2">
          {data.opponent}
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-black px-2 py-0.5 rounded ${isWin ? 'bg-primary/20 text-primary' : 'bg-rose-500/20 text-rose-400'}`}>
            {data.result}
          </span>
          <span className="text-sm font-mono text-foreground font-black">
            {data.elo} <span className={`text-xs ${data.eloChange >= 0 ? 'text-primary' : 'text-rose-400'}`}>({data.eloChange > 0 ? '+' : ''}{data.eloChange})</span>
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function EloChart({ playerId, matches, currentElo = 1200 }: EloChartProps) {
  const data = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    
    const confirmed = matches.filter(m => m.status === 'confirmed');
    if (confirmed.length === 0) return [];

    let current = currentElo;
    const history: EloDataPoint[] = [];
    
    // matches are typically sorted latest first, so we iterate from index 0 (latest) backwards in time
    for (const m of confirmed) {
      let change = 0;
      if (m.player1_id === playerId) change = m.elo_change_p1 || 0;
      else if (m.player2_id === playerId) change = m.elo_change_p2 || 0;
      else if (m.team1_partner_id === playerId) change = m.elo_change_p3 || 0;
      else if (m.team2_partner_id === playerId) change = m.elo_change_p4 || 0;
      
      const isWin = (m.winner_id === m.player1_id && (m.player1_id === playerId || m.team1_partner_id === playerId)) ||
                    (m.winner_id === m.player2_id && (m.player2_id === playerId || m.team2_partner_id === playerId));
                    
      let oppName = "Unknown";
      const p1 = m.player1?.full_name?.split(" ")[0] || "Opponent";
      const p2 = m.player2?.full_name?.split(" ")[0] || "Opponent";
      const pt1 = m.partner1?.full_name?.split(" ")[0];
      const pt2 = m.partner2?.full_name?.split(" ")[0];
      
      const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
      
      if (isTeam1) {
        if (m.team1_partner_id && m.team2_partner_id) {
           const myPartner = m.player1_id === playerId ? pt1 : p1;
           oppName = `w/ ${myPartner} vs ${p2} & ${pt2}`;
        } else {
           oppName = `vs ${p2}`;
        }
      } else {
        if (m.team1_partner_id && m.team2_partner_id) {
           const myPartner = m.player2_id === playerId ? pt2 : p2;
           oppName = `w/ ${myPartner} vs ${p1} & ${pt1}`;
        } else {
           oppName = `vs ${p1}`;
        }
      }
      
      const matchDate = m.date || m.created_at;
      
      history.unshift({
        date: new Date(matchDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        timestamp: new Date(matchDate).getTime(),
        elo: current,
        opponent: oppName,
        result: isWin ? "W" : "L",
        eloChange: change
      });
      
      current -= change;
    }
    
    return history;
  }, [matches, playerId, currentElo]);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <span className="text-muted-foreground text-sm">Not enough match data for ELO history.</span>
      </div>
    );
  }

  // Find min and max for the Y axis to give it some padding
  const minElo = Math.min(...data.map(d => d.elo)) - 20;
  const maxElo = Math.max(...data.map(d => d.elo)) + 20;

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="eloGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
            tickFormatter={(val) => val.substring(0, 6)}
            minTickGap={30}
          />
          <YAxis 
            domain={[minElo, maxElo]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Line
            type="monotone"
            dataKey="elo"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 3, fill: '#1e293b', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
