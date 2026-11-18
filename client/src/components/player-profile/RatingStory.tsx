import { useMemo } from "react";
import { Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { BUCKET_LABEL, RATING_POLICY_TEXT, buildRatingStory, type EloLogRow, type RatingBucket } from "@/lib/ratingStory";

/**
 * Ranking story (WP8): movement, recent contributing results and career best,
 * per rating (singles / doubles / XD), shown only from recorded history.
 */
export function RatingStory({
  logs,
  current,
}: {
  logs: EloLogRow[];
  current: Partial<Record<RatingBucket, number | null>>;
}) {
  const stories = useMemo(() => buildRatingStory(logs ?? [], current), [logs, current]);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section aria-labelledby="rating-story-heading" className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50 p-4 space-y-4">
      <h3 id="rating-story-heading" className="text-sm font-black">Rating history</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {stories.map((s) => (
          <div key={s.bucket} className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3 text-sm">
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">{BUCKET_LABEL[s.bucket]}</p>
            <p className="text-2xl font-black tabular-nums">{s.current ?? "—"}</p>
            {s.logged === 0 ? (
              <p className="text-xs text-muted-foreground">No recorded rating changes.</p>
            ) : (
              <>
                <p className="flex items-center gap-1 text-xs">
                  {s.movement == null ? (
                    <>
                      <Minus className="w-3 h-3" aria-hidden /> No change in the last {s.movementWindowDays} days
                    </>
                  ) : s.movement >= 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-emerald-600" aria-hidden /> +{s.movement} in the last {s.movementWindowDays} days
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3 h-3 text-rose-600" aria-hidden /> {s.movement} in the last {s.movementWindowDays} days
                    </>
                  )}
                </p>
                {s.careerBest && (
                  <p className="text-xs text-muted-foreground">
                    Best recorded: {s.careerBest.rating} ({fmtDate(s.careerBest.date)})
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {s.logged} recorded {s.logged === 1 ? "change" : "changes"} since {fmtDate(s.historyStart!)}
                </p>
                {s.outOfStep && (
                  <p className="text-xs text-[var(--warning)]">
                    The current rating differs from the last recorded change — usually an administrator recalculation.
                  </p>
                )}
                <ol className="mt-2 space-y-0.5" aria-label={`Recent ${BUCKET_LABEL[s.bucket]} rating changes`}>
                  {s.recent.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2 text-xs tabular-nums">
                      <span className="text-muted-foreground">{fmtDate(r.date)}</span>
                      <span className={r.change > 0 ? "text-emerald-700 dark:text-emerald-400 font-bold" : r.change < 0 ? "text-rose-700 dark:text-rose-400 font-bold" : ""}>
                        {r.change > 0 ? `+${r.change}` : r.change}
                        {r.newRating != null && <span className="text-muted-foreground font-normal"> → {r.newRating}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        ))}
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer inline-flex items-center gap-1 min-h-[44px] font-bold text-foreground">
          <Info className="w-3.5 h-3.5" aria-hidden /> How ratings work
        </summary>
        <ul className="mt-1 space-y-1 list-disc pl-4">
          {RATING_POLICY_TEXT.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
