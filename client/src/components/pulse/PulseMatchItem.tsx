import { useMemo, type ReactNode } from "react";
import { Heart, Sparkles, TrendingUp } from "lucide-react";
import { toMatchView, type MatchRow } from "@/lib/matchView";
import { MatchScorecard } from "@/components/match/MatchPrimitives";

/**
 * Pulse match list item (sports-site plan item 12): the shared
 * `MatchScorecard` (same names, seeds, scores, status and link as the Match
 * Centre) plus Pulse's social extras — likes and the prediction poll — in the
 * footer, outside the card link so no control is nested inside another.
 * Keeps the `match-card-<id>` anchor so old shared links still land here.
 */
export function PulseMatchItem({
  match,
  isMatchOfTheDay = false,
  upsetDiff = 0,
  isKudosed,
  kudosCount,
  onKudos,
  prediction,
  highlighted = false,
}: {
  match: MatchRow & Record<string, unknown>;
  isMatchOfTheDay?: boolean;
  upsetDiff?: number;
  isKudosed: boolean;
  kudosCount: number;
  onKudos: () => void;
  prediction?: ReactNode;
  highlighted?: boolean;
}) {
  const view = useMemo(() => toMatchView(match), [match]);
  const badges =
    isMatchOfTheDay || upsetDiff > 0 ? (
      <>
        {isMatchOfTheDay && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 text-[10px] font-black">
            <Sparkles className="w-3 h-3" aria-hidden /> Match of the day
          </span>
        )}
        {upsetDiff > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300 px-2 py-0.5 text-[10px] font-black">
            <TrendingUp className="w-3 h-3" aria-hidden /> Upset +{upsetDiff}
          </span>
        )}
      </>
    ) : undefined;

  const footer = (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onKudos}
          aria-pressed={isKudosed}
          aria-label={`${isKudosed ? "Unlike" : "Like"} this match, ${kudosCount} ${kudosCount === 1 ? "like" : "likes"}`}
          className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-xs font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isKudosed
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:text-rose-600"
          }`}
        >
          <Heart className={`w-4 h-4 ${isKudosed ? "fill-current" : ""}`} aria-hidden />
          <span className="tabular-nums">{kudosCount}</span>
        </button>
      </div>
      {prediction}
    </div>
  );

  return (
    <div
      id={`match-card-${view.id}`}
      className={`scroll-mt-24 rounded-2xl transition-shadow ${highlighted ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <MatchScorecard view={view} showShare badges={badges} footer={footer} />
    </div>
  );
}
