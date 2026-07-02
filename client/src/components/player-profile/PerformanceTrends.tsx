import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Match {
  id: string;
  winner_id?: string;
  status?: string;
  created_at?: string;
  date?: string;
  elo_change_p1?: number;
  elo_change_p2?: number;
  elo_change_p3?: number;
  elo_change_p4?: number;
  player1_id?: string;
  player2_id?: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  match_score?: string;
  score?: string;
}

interface Props {
  matches: Match[];
  playerId: string;
}

function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120, h = 36;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export function PerformanceTrends({ matches, playerId }: Props) {
  const isWinner = (m: Match) => {
    if (!m.winner_id) return false;
    const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
    const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
    return isTeam1 ? isTeam1Winner : !isTeam1Winner;
  };

  const data = useMemo(() => {
    const confirmed = matches
      .filter((m) => m.status === "confirmed" && (m.date || m.created_at))
      .sort((a, b) => {
        const timeA = new Date(a.date || a.created_at!).getTime();
        const timeB = new Date(b.date || b.created_at!).getTime();
        return timeB - timeA; // Descending (newest first)
      })
      .slice(0, 20)
      .reverse(); // Ascending (oldest to newest for the chart)

    if (confirmed.length < 5) return null;

    // Rolling 5-match win rate
    const winRates: number[] = [];
    for (let i = 4; i < confirmed.length; i++) {
      const window = confirmed.slice(i - 4, i + 1);
      const wins = window.filter(isWinner).length;
      winRates.push((wins / 5) * 100);
    }

    // ELO changes over time
    const eloChanges: number[] = confirmed.map((m) => {
      if (m.player1_id === playerId) return m.elo_change_p1 ?? 0;
      if (m.player2_id === playerId) return m.elo_change_p2 ?? 0;
      if (m.team1_partner_id === playerId) return m.elo_change_p3 ?? 0;
      if (m.team2_partner_id === playerId) return m.elo_change_p4 ?? 0;
      return 0;
    });

    // Cumulative ELO movement
    let cumElo = 0;
    const cumulativeElo: number[] = eloChanges.map((c) => (cumElo += c));

    const lastFive = confirmed.slice(-5);
    const recentWins = lastFive.filter(isWinner).length;
    const recentForm = recentWins >= 4 ? "hot" : recentWins <= 1 ? "cold" : "neutral";

    return { winRates, cumulativeElo, recentForm, recentWins, total: confirmed.length };
  }, [matches, playerId]);

  if (!data) return null;

  const formConfig = {
    hot: { label: "On Fire", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950/40", icon: TrendingUp },
    neutral: { label: "Steady", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40", icon: Minus },
    cold: { label: "In a Slump", color: "text-muted-foreground dark:text-muted-foreground", bg: "bg-slate-100 dark:bg-slate-800", icon: TrendingDown },
  }[data.recentForm];

  const FormIcon = formConfig.icon;
  const eloTrend = data.cumulativeElo[data.cumulativeElo.length - 1];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black text-slate-800 dark:text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Performance Trends
        </h3>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${formConfig.bg} ${formConfig.color}`}>
          <FormIcon className="w-3.5 h-3.5" />
          {formConfig.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Rolling Win Rate */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Win Rate (rolling 5)</p>
          <SparkLine values={data.winRates} color="#10b981" />
          <p className="text-xs font-bold text-muted-foreground dark:text-slate-300 mt-1">
            {data.winRates[data.winRates.length - 1]?.toFixed(0)}% last window
          </p>
        </div>

        {/* ELO Movement */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">ELO Movement</p>
          <SparkLine values={data.cumulativeElo} color={eloTrend >= 0 ? "#10b981" : "#f43f5e"} />
          <p className={`text-xs font-bold mt-1 ${eloTrend >= 0 ? "text-primary dark:text-primary" : "text-rose-600 dark:text-rose-400"}`}>
            {eloTrend >= 0 ? "+" : ""}{eloTrend} pts overall
          </p>
        </div>
      </div>

      {/* Recent form dots */}
      <div>
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">Recent Form (last 5)</p>
        <div className="flex gap-1.5">
          {matches
            .filter((m) => m.status === "confirmed")
            .slice(-5)
            .map((m, i) => {
              const won = isWinner(m);
              let myGames = 0;
              let oppGames = 0;
              const scoreStr = m.match_score || m.score || "";
              const sets = scoreStr.split(",").map(s => s.trim());
              sets.forEach(set => {
                const parts = set.split("-");
                if (parts.length === 2) {
                  const p1 = parseInt(parts[0], 10);
                  const p2 = parseInt(parts[1], 10);
                  if (!isNaN(p1) && !isNaN(p2)) {
                    const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
                    const myScore = isTeam1 ? p1 : p2;
                    const oppScore = isTeam1 ? p2 : p1;
                    if (myScore > oppScore) myGames++;
                    else if (oppScore > myScore) oppGames++;
                  }
                }
              });
              const matchScoreText = myGames || oppGames ? `${myGames}-${oppGames}` : (won ? "W" : "L");
              
              return (
                <div key={i} title={won ? "Win" : "Loss"}
                  className={`h-8 px-2 min-w-[32px] rounded-xl flex items-center justify-center text-[11px] font-black tracking-tight ${won ? "bg-primary/15 dark:bg-primary/40 text-primary dark:text-primary" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
                  {matchScoreText}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
