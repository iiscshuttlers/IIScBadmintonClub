import { Check } from "lucide-react";

interface Props {
  sets_history?: string[] | null;
  score?: string | null;
  team1_label?: string;
  team2_label?: string;
  winner_side?: 1 | 2 | null;
  status?: string;
  compact?: boolean;
}

/**
 * Game-by-game score as two scoreboard rows, matching MatchScorecard: the
 * winner is bright with a check mark, the other side stays readable grey, and
 * each game's higher score is bold. No per-card "Player / G1 / Sets" header.
 */
export function MatchScoreDisplay({ sets_history, score, team1_label, team2_label, winner_side, status, compact }: Props) {
  if (status === "walkover") {
    return (
      <span className="text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-muted-strong text-soft">
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

  if (compact) {
    return (
      <span className="font-mono text-xs text-soft">
        {effectiveSets.join(", ")}
      </span>
    );
  }

  const renderLabel = (label: string) => {
    if (!label.includes("&")) return <span className="break-words">{label}</span>;
    const parts = label.split("&");
    return (
      <span className="flex flex-col leading-tight">
        <span className="break-words">{parts[0].trim()}</span>
        <span className="break-words">{parts[1].trim()}</span>
      </span>
    );
  };

  const row = (side: 1 | 2, label: string) => {
    const won = winner_side === side;
    return (
      <div className="flex items-start justify-between gap-3 py-1.5">
        <div className="min-w-0 flex items-start gap-2">
          <span className="w-4 shrink-0 pt-0.5" aria-hidden>
            {won && <Check className="w-4 h-4 text-primary" strokeWidth={3} />}
          </span>
          <span className={`min-w-0 text-sm ${won ? "font-black text-foreground" : "font-medium text-soft"}`}>
            {renderLabel(label)}
            {won && <span className="sr-only"> (winner)</span>}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          {parsed.map((g, i) => {
            const mine = side === 1 ? g.a : g.b;
            const theirs = side === 1 ? g.b : g.a;
            return (
              <span
                key={i}
                className={`w-7 text-center font-mono text-sm tabular-nums ${
                  mine > theirs ? "font-black text-foreground" : "text-muted-foreground"
                }`}
              >
                {mine}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="divide-y divide-border">
      <p className="sr-only">Score: {parsed.map((g, i) => `Game ${i + 1} ${g.a}–${g.b}`).join(", ")}</p>
      {row(1, team1_label || "Team 1")}
      {row(2, team2_label || "Team 2")}
    </div>
  );
}
