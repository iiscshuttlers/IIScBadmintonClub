import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { useOpenMatchViews } from "@/hooks/queries/useMatchViews";
import { compareCourtQueue, courtLabel, type MatchView } from "@/lib/matchView";
import { matchPath } from "@/lib/tournamentRoutes";

/**
 * Cricbuzz/FotMob-style score strip: a single horizontally scrolling row of
 * compact live-match chips shown above the tournament tabs, so live scores
 * stay one tap away from Overview, Draw, Schedule and Results.
 *
 * Renders nothing when no match is live — never an empty bar.
 */

function sideScore(v: MatchView, side: 0 | 1): string {
  const g = v.games[v.games.length - 1];
  if (!g) return "";
  return String(side === 0 ? g.side1 : g.side2);
}

function gamesWon(v: MatchView, side: 0 | 1): number {
  // Completed games only: the last game is the one in progress.
  return v.games.slice(0, -1).filter((g) => (side === 0 ? g.side1 > g.side2 : g.side2 > g.side1)).length;
}

function TickerChip({ v }: { v: MatchView }) {
  const meta = [v.discipline ?? v.categoryLabel, v.court ? courtLabel(v.court) : null].filter(Boolean).join(" · ");
  const label = `${v.sides[0].label} ${sideScore(v, 0) || "–"}, ${v.sides[1].label} ${sideScore(v, 1) || "–"}, ${meta}`;
  return (
    <Link
      href={matchPath(v.tournamentId, v.id)}
      aria-label={`Live: ${label}`}
      className="snap-start shrink-0 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 hover:border-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 motion-safe:animate-pulse" aria-hidden /> Live
        </span>
        <span className="truncate">{meta}</span>
      </div>
      {([0, 1] as const).map((s) => (
        <div key={s} className="flex items-center justify-between gap-2 mt-0.5" aria-hidden>
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{v.sides[s].label}</span>
          <span className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums text-sm">
            {v.games.length > 1 && <span className="text-[10px] text-muted-foreground">({gamesWon(v, s)})</span>}
            <span className="font-black text-slate-900 dark:text-white w-5 text-right">{sideScore(v, s)}</span>
          </span>
        </div>
      ))}
    </Link>
  );
}

export function LiveScoreTicker({
  tournamentId,
  heading,
  label = "Live scores",
}: {
  tournamentId: string;
  /** Optional visible heading (e.g. the tournament name on Home). */
  heading?: ReactNode;
  label?: string;
}) {
  const { views } = useOpenMatchViews(tournamentId);
  const live = useMemo(() => views.filter((v) => v.state === "live").sort(compareCourtQueue), [views]);
  if (live.length === 0) return null;
  return (
    <section aria-label={label} className="mb-4 -mx-4 sm:mx-0">
      {heading && <div className="px-4 sm:px-0 mb-1.5">{heading}</div>}
      <div className="flex gap-2 overflow-x-auto snap-x px-4 sm:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {live.map((v) => (
          <TickerChip key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}
