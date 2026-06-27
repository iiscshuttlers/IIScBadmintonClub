interface Props {
  sets_history?: string[] | null;
  team1_label?: string;
  team2_label?: string;
  winner_side?: 1 | 2 | null;
  status?: string;
  compact?: boolean;
}

/** Renders a completed match score as a styled game-by-game table. */
export function MatchScoreDisplay({ sets_history, team1_label, team2_label, winner_side, status, compact }: Props) {
  if (status === "walkover") {
    return (
      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
        W/O — {winner_side === 1 ? team1_label : team2_label}
      </span>
    );
  }

  if (!sets_history?.length) return null;

  const parsed = sets_history.map((s) => {
    const [a, b] = s.split("-").map(Number);
    return { a: isNaN(a) ? 0 : a, b: isNaN(b) ? 0 : b };
  });

  const t1Sets = parsed.filter((s) => s.a > s.b).length;
  const t2Sets = parsed.filter((s) => s.b > s.a).length;

  if (compact) {
    return (
      <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
        {sets_history.join(", ")}
      </span>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1 pr-3 text-slate-400 font-bold w-full">Player</th>
            {parsed.map((_, i) => (
              <th key={i} className="text-center py-1 px-2 text-slate-400 font-bold min-w-[2rem]">G{i + 1}</th>
            ))}
            <th className="text-center py-1 px-2 text-slate-400 font-bold">Sets</th>
          </tr>
        </thead>
        <tbody>
          <tr className={winner_side === 1 ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-400 dark:text-slate-500"}>
            <td className="py-1 pr-3 truncate max-w-[120px]">{team1_label || "Team 1"}</td>
            {parsed.map((s, i) => (
              <td key={i} className={`text-center py-1 px-2 rounded ${s.a > s.b ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>{s.a}</td>
            ))}
            <td className="text-center py-1 px-2 font-black">{t1Sets}</td>
          </tr>
          <tr className={winner_side === 2 ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-400 dark:text-slate-500"}>
            <td className="py-1 pr-3 truncate max-w-[120px]">{team2_label || "Team 2"}</td>
            {parsed.map((s, i) => (
              <td key={i} className={`text-center py-1 px-2 rounded ${s.b > s.a ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>{s.b}</td>
            ))}
            <td className="text-center py-1 px-2 font-black">{t2Sets}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
