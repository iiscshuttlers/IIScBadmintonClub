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

  const renderLabel = (label: string) => {
    if (!label.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{label}</div>;
    const parts = label.split("&");
    return (
      <div className="flex flex-col leading-[1.1] py-0.5">
        <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
        <span className="text-[10px] opacity-60 my-0.5 font-bold text-slate-400 dark:text-slate-500">&amp;</span>
        <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
      </div>
    );
  };

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
          <tr className={winner_side === 1 ? "text-primary dark:text-primary font-black" : "text-slate-400 dark:text-slate-500"}>
            <td className="py-1 pr-3 align-middle">{renderLabel(team1_label || "Team 1")}</td>
            {parsed.map((s, i) => (
              <td key={i} className={`text-center py-1 px-2 rounded align-middle ${s.a > s.b ? "bg-primary/10 dark:bg-primary/30" : ""}`}>{s.a}</td>
            ))}
            <td className="text-center py-1 px-2 font-black align-middle">{t1Sets}</td>
          </tr>
          <tr className={winner_side === 2 ? "text-primary dark:text-primary font-black" : "text-slate-400 dark:text-slate-500"}>
            <td className="py-1 pr-3 align-middle">{renderLabel(team2_label || "Team 2")}</td>
            {parsed.map((s, i) => (
              <td key={i} className={`text-center py-1 px-2 rounded align-middle ${s.b > s.a ? "bg-primary/10 dark:bg-primary/30" : ""}`}>{s.b}</td>
            ))}
            <td className="text-center py-1 px-2 font-black align-middle">{t2Sets}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
