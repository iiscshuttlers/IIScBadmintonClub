import { useMemo, useState, type ReactNode } from "react";
import { Activity, CalendarClock, LayoutGrid, RefreshCw, WifiOff, AlertTriangle, Loader2 } from "lucide-react";
import { useQueryState } from "@/hooks/useQueryState";
import {
  COMPLETED_PAGE_SIZE,
  STALE_AFTER_MS,
  useFinishedMatchViews,
  useOpenMatchViews,
} from "@/hooks/queries/useMatchViews";
import {
  bucketOf,
  buildCourtQueues,
  compareCourtQueue,
  compareUpcoming,
  courtLabel,
  filterMatches,
  matchDay,
  type MatchView,
} from "@/lib/matchView";
import { DISCIPLINES, parseDiscipline } from "@/lib/tournamentRoutes";
import { MatchScorecard } from "@/components/match/MatchPrimitives";
import { dayChipLabel, liveCourts } from "@/lib/matchGrouping";
import { ChipStrip, type ChipOption } from "@/components/match/ChipStrip";
import { ResultsByRound } from "@/components/match/ResultsByRound";

/** Supabase caps a select at 1,000 rows; no club tournament comes close. */
const RESULTS_ALL_LIMIT = 999;

/**
 * Match Centre (WP6) — Live, Upcoming and Courts for an active tournament,
 * Completed for results. Filters live in the URL (`cat`, `court`, `date`,
 * `view`) so a filtered view can be shared.
 */

type LiveView = "live" | "upcoming" | "courts";

function FreshnessBar({
  updatedAt,
  refreshFailed,
  online,
  watchingLive,
  onRetry,
}: {
  updatedAt: number | null;
  refreshFailed: boolean;
  online: boolean;
  watchingLive: boolean;
  onRetry: () => void;
}) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null;
  const stale = watchingLive && updatedAt != null && Date.now() - updatedAt > STALE_AFTER_MS;
  let tone = "text-muted-foreground";
  let icon: ReactNode = null;
  let text = time ? `Confirmed by server at ${time}` : "Not yet loaded from the server";
  if (!online) {
    tone = "text-amber-700 dark:text-amber-400";
    icon = <WifiOff className="w-3.5 h-3.5" aria-hidden />;
    text = `You're offline. Showing results confirmed at ${time ?? "—"}; live scores may have changed.`;
  } else if (refreshFailed) {
    tone = "text-amber-700 dark:text-amber-400";
    icon = <AlertTriangle className="w-3.5 h-3.5" aria-hidden />;
    text = `Couldn't refresh. Showing results confirmed at ${time ?? "—"}.`;
  } else if (stale) {
    tone = "text-amber-700 dark:text-amber-400";
    icon = <AlertTriangle className="w-3.5 h-3.5" aria-hidden />;
    text = `Last confirmed at ${time}; may be out of date.`;
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${tone}`} role="status" aria-live="polite">
      {icon}
      <span>{text}</span>
      {(refreshFailed || stale || !online) && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-bold underline underline-offset-2">
          <RefreshCw className="w-3 h-3" aria-hidden /> Refresh
        </button>
      )}
    </div>
  );
}

function FilterBar({
  courts,
  liveCourtSet,
  dates,
  cat,
  setCat,
  court,
  setCourt,
  date,
  setDate,
  showDate,
}: {
  courts: string[];
  liveCourtSet: string[];
  dates: string[];
  cat: string;
  setCat: (v: string) => void;
  court: string;
  setCourt: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  showDate: boolean;
}) {
  const courtOptions: ChipOption[] = [
    { value: "", label: "All courts" },
    ...courts.map((c) => {
      const isLive = liveCourtSet.includes(c);
      return {
        value: c,
        label: (
          <>
            {courtLabel(c)}
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-600 motion-safe:animate-pulse" aria-hidden />}
          </>
        ),
        srSuffix: isLive ? ", live" : undefined,
      };
    }),
  ];
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Discipline" className="flex flex-wrap gap-1">
        {(["ALL", ...DISCIPLINES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={`min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-black transition-colors ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {c === "ALL" ? "All" : c}
          </button>
        ))}
      </div>
      {/* Court strip: hidden when there's nothing to choose between. */}
      {(courts.length > 1 || !!court) && <ChipStrip label="Court" options={courtOptions} value={court} onChange={setCourt} />}
      {showDate && (
        <ChipStrip
          label="Day"
          options={[{ value: "", label: "All days" }, ...dates.map((d) => ({ value: d, label: dayChipLabel(d) }))]}
          value={date}
          onChange={setDate}
        />
      )}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
      <p className="font-black text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
      <p className="font-black text-slate-700 dark:text-slate-200">Couldn't load matches</p>
      <p className="text-sm text-muted-foreground mt-1">Nothing is shown rather than an out-of-date list.</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-black">
        <RefreshCw className="w-4 h-4" aria-hidden /> Retry
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-10" role="status">
      <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
      <span className="sr-only">Loading matches…</span>
    </div>
  );
}

function CourtQueues({ views }: { views: MatchView[] }) {
  const queues = useMemo(() => buildCourtQueues(views), [views]);
  const unassigned = useMemo(
    () => views.filter((v) => !v.court && (v.state === "live" || v.state === "scheduled")).sort(compareUpcoming),
    [views],
  );

  if (queues.length === 0 && unassigned.length === 0) {
    return <Empty title="No matches are assigned to courts" hint="Matches appear here once an organiser assigns a court." />;
  }

  return (
    <div className="space-y-6">
      {queues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {queues.map((q) => (
            <section
              key={q.court}
              aria-labelledby={`court-${q.court}`}
              className="bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 space-y-3"
            >
              <h3 id={`court-${q.court}`} className="font-black text-slate-800 dark:text-slate-100">
                {courtLabel(q.court)}
              </h3>
              {q.playing.length > 1 && (
                <div role="alert" className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>Court conflict: {q.playing.length} matches marked live simultaneously</span>
                </div>
              )}
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Playing</p>
                {q.playing.length > 0 ? (
                  <div className="space-y-2">
                    {q.playing.map((v) => (
                      <MatchScorecard key={v.id} view={v} showCourt={false} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Court free</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Next</p>
                {q.next ? <MatchScorecard view={q.next} showCourt={false} /> : <p className="text-sm text-muted-foreground">Nothing queued</p>}
              </div>
              {q.following.length > 0 && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Following</p>
                  <ol className="space-y-1 text-sm">
                    {q.following.map((v, i) => (
                      <li key={v.id} className="flex items-start gap-2">
                        <span className="text-muted-foreground tabular-nums w-5 shrink-0">{i + 2}.</span>
                        <span className="min-w-0">
                          <span className="font-semibold">{v.sides[0].label}</span> vs <span className="font-semibold">{v.sides[1].label}</span>
                          <span className="text-muted-foreground"> · {v.discipline ?? v.categoryLabel} {v.roundName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {v.scheduledAt
                              ? `Scheduled ${new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                              : "No time set — follows the queue"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <section aria-labelledby="unassigned-heading" className="bg-slate-50 dark:bg-slate-950/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 id="unassigned-heading" className="font-black text-slate-800 dark:text-slate-100 text-sm">
              Unassigned fixtures
            </h3>
            <span className="text-xs font-bold text-muted-foreground tabular-nums">{unassigned.length} {unassigned.length === 1 ? "fixture" : "fixtures"}</span>
          </div>
          <ul className="space-y-2">
            {unassigned.map((v) => (
              <li key={v.id}>
                <MatchScorecard view={v} showCourt={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function MatchCentre({
  tournamentId,
  mode,
  liveShownAbove = false,
}: {
  tournamentId: string;
  mode: "live" | "results";
  /** Live broadcast cards are already on screen above: open on Upcoming instead of repeating them. */
  liveShownAbove?: boolean;
}) {
  const [view, setViewParam] = useQueryState<LiveView>("view", "live");
  const [viewChosen, setViewChosen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("view");
    } catch {
      return false;
    }
  });
  const setView = (v: LiveView) => {
    setViewChosen(true);
    setViewParam(v);
  };
  const [catRaw, setCat] = useQueryState<string>("cat", "ALL", true);
  const [court, setCourt] = useQueryState<string>("court", "", true);
  const [date, setDate] = useQueryState<string>("date", "", true);
  const cat = parseDiscipline(catRaw) ?? "ALL";
  const discipline = cat === "ALL" ? null : cat;

  const open = useOpenMatchViews(tournamentId);
  // Results are grouped Final-first, which needs every round on the page:
  // paging by finish time would leave early rounds half-loaded. Rounds before
  // the quarter-finals render collapsed, so the full set stays light.
  const finished = useFinishedMatchViews(tournamentId, {
    discipline,
    court: court || null,
    limit: mode === "results" ? RESULTS_ALL_LIMIT : COMPLETED_PAGE_SIZE,
  });

  const source = mode === "results" ? finished : open;
  const allViews = source.views;
  const courts = useMemo(
    () => Array.from(new Set([...open.views, ...finished.views].map((v) => v.court).filter((c): c is string => !!c))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [open.views, finished.views],
  );
  const dates = useMemo(
    () => Array.from(new Set(allViews.map(matchDay).filter((d): d is string => !!d))).sort(),
    [allViews],
  );
  const liveCourtSet = useMemo(() => liveCourts(open.views), [open.views]);
  const filtered = useMemo(() => filterMatches(allViews, { discipline, court: court || null, date: date || null }), [allViews, discipline, court, date]);
  const filtersOn = !!discipline || !!court || !!date;

  const live = useMemo(() => filtered.filter((v) => bucketOf(v) === "live").sort(compareCourtQueue), [filtered]);
  const upcoming = useMemo(() => filtered.filter((v) => bucketOf(v) === "upcoming").sort(compareUpcoming), [filtered]);

  const preferredView: LiveView = !viewChosen && liveShownAbove ? "upcoming" : view;
  const effectiveView: LiveView = mode === "results" ? "live" : (["live", "upcoming", "courts"] as const).includes(preferredView) ? preferredView : "live";

  const tabs: Array<{ id: LiveView; label: string; icon: typeof Activity; count: number }> = [
    { id: "live", label: "Live", icon: Activity, count: live.length },
    { id: "upcoming", label: "Upcoming", icon: CalendarClock, count: upcoming.length },
    { id: "courts", label: "Courts", icon: LayoutGrid, count: new Set(filtered.filter((v) => v.court).map((v) => v.court)).size },
  ];

  const list = (items: MatchView[], empty: { title: string; hint?: string }) =>
    items.length > 0 ? (
      <ul className="space-y-3">
        {items.map((v) => (
          <li key={v.id}>
            <MatchScorecard view={v} />
          </li>
        ))}
      </ul>
    ) : (
      <Empty title={filtersOn ? "No matches match these filters" : empty.title} hint={filtersOn ? "Clear a filter to see more." : empty.hint} />
    );

  return (
    <section aria-label={mode === "results" ? "Results" : "Match Centre"} className="space-y-4 mb-6">
      {mode === "live" && (
        <div role="tablist" aria-label="Match Centre view" className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={effectiveView === t.id}
              onClick={() => setView(t.id)}
              className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-black transition-colors ${
                effectiveView === t.id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <t.icon className="w-4 h-4" aria-hidden />
              {t.label}
              {source.status === "ready" && <span className="text-xs opacity-70 tabular-nums">({t.count})</span>}
            </button>
          ))}
        </div>
      )}

      <FilterBar
        courts={courts}
        liveCourtSet={liveCourtSet}
        dates={dates}
        cat={cat}
        setCat={setCat}
        court={court}
        setCourt={setCourt}
        date={date}
        setDate={setDate}
        showDate={dates.length > 1 || !!date}
      />

      <FreshnessBar
        updatedAt={source.updatedAt}
        refreshFailed={source.refreshFailed}
        online={open.online}
        watchingLive={mode === "live" && live.length > 0}
        onRetry={source.retry}
      />

      {source.status === "loading" ? (
        <Loading />
      ) : source.status === "error" ? (
        <LoadFailed onRetry={source.retry} />
      ) : mode === "results" ? (
        filtered.length === 0 && filtersOn ? (
          <Empty title="No matches match these filters" hint="Clear a filter to see more." />
        ) : (
          <ResultsByRound
            views={filtered}
            emptyTitle="No results yet"
            emptyHint="Completed matches, walkovers and cancellations appear here."
          />
        )
      ) : effectiveView === "live" ? (
        list(live, { title: "No matches on court right now", hint: "Check Upcoming or Courts for what's next." })
      ) : effectiveView === "upcoming" ? (
        list(upcoming, { title: "No upcoming matches", hint: "Matches appear once the draw is published." })
      ) : (
        <CourtQueues views={filtered} />
      )}

    </section>
  );
}
