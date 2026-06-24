import { memo } from "react";

interface BeautifulScoreDisplayProps {
  score?: string;
  className?: string;
}

export const BeautifulScoreDisplay = memo(function BeautifulScoreDisplay({ score, className = "" }: BeautifulScoreDisplayProps) {
  if (!score) return <span className="text-slate-400">—</span>;

  // Extract set scores (e.g., "15-21, 22-20, 19-21 [Mixed Doubles: ...]")
  // By using parseInt, it safely strips out the trailing string because parseInt stops at non-numeric characters.
  const parsedSets = score
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split("-");
      if (parts.length !== 2) return null;
      const p1 = parseInt(parts[0].trim(), 10);
      const p2 = parseInt(parts[1].trim(), 10);
      if (Number.isNaN(p1) || Number.isNaN(p2)) return null;
      return { p1, p2 };
    })
    .filter(Boolean) as { p1: number; p2: number }[];

  if (parsedSets.length === 0) {
    return <span className={`text-slate-500 font-medium ${className}`}>{score.replace(/\s*\[.*\]/, "")}</span>;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {parsedSets.map((s, idx) => {
        const p1Won = s.p1 > s.p2;
        const p2Won = s.p2 > s.p1;
        return (
          <span
            key={idx}
            className="font-mono text-[11px] font-black tracking-widest px-2 py-0.5 rounded-md border shadow-sm bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 flex items-center"
          >
            <span className={p1Won ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 opacity-80"}>
              {s.p1}
            </span>
            <span className="opacity-40 mx-0.5">-</span>
            <span className={p2Won ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 opacity-80"}>
              {s.p2}
            </span>
          </span>
        );
      })}
    </div>
  );
});
