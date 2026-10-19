interface Props {
  sets_history?: string[] | null;
  score?: string | null;
  team1_label?: string;
  team2_label?: string;
  winner_side?: 1 | 2 | null;
  status?: string;
  compact?: boolean;
}

/** Renders a completed match score as a styled game-by-game table. */
export function MatchScoreDisplay({ sets_history, score, team1_label, team2_label, winner_side, status, compact }: Props) {
  if (status === "walkover") {
    return (
      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-muted-foreground dark:text-muted-foreground">
        W/O — {winner_side === 1 ? team1_label : team2_label}
      </span>
    );
  }

  const effectiveSets = sets_history?.length ? sets_history : score ? score.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (!effectiveSets.length) return null;

  const parsed = effectiveSets.map((s) => {
    const [a, b] = s.split("-").map(Number);
    return { a: isNaN(a) ? 0 : a, b: isNaN(b) ? 0 : b };
  });

  const t1Sets = parsed.filter((s) => s.a > s.b).length;
  const t2Sets = parsed.filter((s) => s.b > s.a).length;

  if (compact) {
    return (
      <span className="font-mono text-xs text-muted-foreground dark:text-slate-300">
        {effectiveSets.join(", ")}
      </span>
    );
  }

  const renderLabel = (label: string) => {
    if (!label.includes("&")) return <div className="break-words whitespace-normal leading-[1.1]">{label}</div>;
    const parts = label.split("&");
    return (
      <div className="flex flex-col leading-[1.1] py-0.5">
        <span className="break-words whitespace-normal w-full">{parts[0].trim()}</span>
        <span className="text-[10px] opacity-60 my-0.5 font-bold text-muted-foreground dark:text-muted-foreground">&amp;</span>
        <span className="break-words whitespace-normal w-full">{parts[1].trim()}</span>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1 pr-3 text-muted-foreground font-bold w-full">Player</th>
            {parsed.map((_, i) => (
              <th key={i} className="text-center py-1 px-2 text-muted-foreground font-bold min-w-[2rem]">G{i + 1}</th>
            ))}
            <th className="text-center py-1 px-2 text-muted-foreground font-bold">Sets</th>
          </tr>
        </thead>
        <tbody>
          <tr className={winner_side === 1 ? "text-primary dark:text-primary font-black" : "text-muted-foreground dark:text-muted-foreground"}>
            <td className="py-1 pr-3 align-middle">{renderLabel(team1_label || "Team 1")}</td>
            {parsed.map((s, i) => (
              <td key={i} className="text-center py-1 px-2 align-middle">
                <span className={s.a > s.b ? "inline-block px-1.5 py-0.5 rounded-md bg-primary/10 dark:bg-primary/15" : ""}>{s.a}</span>
              </td>
            ))}
            <td className="text-center py-1 px-2 font-black align-middle">{t1Sets}</td>
          </tr>
          <tr className={winner_side === 2 ? "text-primary dark:text-primary font-black" : "text-muted-foreground dark:text-muted-foreground"}>
            <td className="py-1 pr-3 align-middle">{renderLabel(team2_label || "Team 2")}</td>
            {parsed.map((s, i) => (
              <td key={i} className="text-center py-1 px-2 align-middle">
                <span className={s.b > s.a ? "inline-block px-1.5 py-0.5 rounded-md bg-primary/10 dark:bg-primary/15" : ""}>{s.b}</span>
              </td>
            ))}
            <td className="text-center py-1 px-2 font-black align-middle">{t2Sets}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
