import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { courtLabel, type MatchSide, type MatchState, type MatchView } from "@/lib/matchView";
import { matchPath } from "@/lib/tournamentRoutes";
import { currentGameIndex } from "@/lib/matchGrouping";
import type { FormEntry } from "@/services/formService";
import { ShareResultButton } from "@/components/match/ShareResultButton";
import { canShareResult } from "@/lib/matchViewShare";

/**
 * Shared competition presentation primitives (WP6). Every surface that shows
 * a tournament match should compose these so names, seeds, scores, winners
 * and statuses read the same everywhere.
 */

const STATE_CLASS: Record<MatchState, string> = {
  live: "bg-red-600 text-white",
  scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  unscheduled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  walkover: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  cancelled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  unknown: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

/** Status is always written out; colour is supplementary. */
export function MatchStatusBadge({ view }: { view: Pick<MatchView, "state" | "statusLabel"> }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${STATE_CLASS[view.state]}`}>
      {view.state === "live" && <span className="w-1.5 h-1.5 rounded-full bg-white motion-safe:animate-pulse" aria-hidden />}
      {view.statusLabel}
    </span>
  );
}

export function SeedMark({ seed }: { seed: number | null }) {
  if (seed == null) return null;
  return (
    <span className="shrink-0 text-[10px] font-black text-muted-foreground tabular-nums" title={`Seed ${seed}`}>
      [{seed}]<span className="sr-only"> seed {seed}</span>
    </span>
  );
}

/** One side: names (wrapping, not truncated), seed, winner text, per-game scores aligned. */
export function MatchSideRow({
  side,
  index,
  view,
}: {
  side: MatchSide;
  index: 0 | 1;
  view: Pick<MatchView, "games" | "state">;
}) {
  // BWF/Cricbuzz-style: the game in progress is boxed so the live score reads first.
  const liveIdx = currentGameIndex(view);
  const nameClass = side.isWinner
    ? "font-black text-slate-900 dark:text-white"
    : side.isTbd || side.isBye
      ? "italic text-muted-foreground"
      : "font-semibold text-slate-700 dark:text-slate-200";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
        <span className={`break-words ${nameClass}`}>{side.label}</span>
        <SeedMark seed={side.seed} />
        {side.isWinner && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-amber-600 dark:text-amber-400">
            <Trophy className="w-3 h-3" aria-hidden /> Winner
          </span>
        )}
      </div>
      {view.games.length > 0 && (
        <div className="flex gap-1 shrink-0" aria-hidden>
          {view.games.map((g, i) => {
            const mine = index === 0 ? g.side1 : g.side2;
            const theirs = index === 0 ? g.side2 : g.side1;
            return (
              <span
                key={i}
                className={`w-7 text-center font-mono text-sm tabular-nums rounded ${
                  i === liveIdx
                    ? "font-black bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
                    : mine > theirs
                      ? "font-black text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {mine}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Screen-reader friendly score line: "Game 1 21–13, Game 2 21–11". */
export function scoreSummary(view: Pick<MatchView, "games" | "scoreText">): string | null {
  if (view.games.length > 0) return view.games.map((g, i) => `Game ${i + 1} ${g.side1}–${g.side2}`).join(", ");
  return view.scoreText;
}

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Scheduled, actual start and actual finish shown separately; never invented. */
export function MatchTimes({ view, compact = false }: { view: Pick<MatchView, "scheduledAt" | "startedAt" | "endedAt" | "state">; compact?: boolean }) {
  const parts: string[] = [];
  const scheduled = fmt(view.scheduledAt);
  const started = fmt(view.startedAt);
  const ended = fmt(view.endedAt);
  if (scheduled) parts.push(`Scheduled ${scheduled}`);
  else if (view.state === "unscheduled" || view.state === "scheduled") parts.push("No scheduled time");
  // Compact cards show the actual start only while live; finish time always.
  if (started && (!compact || view.state === "live")) parts.push(`Started ${started}`);
  if (ended) parts.push(`Finished ${ended}`);
  if (parts.length === 0) return null;
  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
}

/** Compact scorecard used by Match Centre, court queues and (incrementally) other surfaces. */
export function MatchScorecard({
  view,
  showCourt = true,
  linked = true,
  showShare = false,
}: {
  view: MatchView;
  showCourt?: boolean;
  linked?: boolean;
  /** Completed/walkover only: a share icon kept outside the link (no nested controls). */
  showShare?: boolean;
}) {
  const summary = scoreSummary(view);
  const share = showShare && canShareResult(view);
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        <span>{view.discipline ?? view.categoryLabel}</span>
        {view.roundName && <span>· {view.roundName}</span>}
        {view.rubberLabel && <span>· {view.rubberLabel}</span>}
        {showCourt && view.court && <span>· {courtLabel(view.court)}</span>}
        <span className="ml-auto normal-case tracking-normal">
          <MatchStatusBadge view={view} />
        </span>
      </div>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        <MatchSideRow side={view.sides[0]} index={0} view={view} />
        <MatchSideRow side={view.sides[1]} index={1} view={view} />
      </div>
      {summary && <p className="sr-only">Score: {summary}</p>}
      {view.scoreText && <p className="mt-1 font-mono text-sm tabular-nums">{view.scoreText}</p>}
      <div className={`mt-1 ${share ? "pr-10" : ""}`}>
        <MatchTimes view={view} compact />
      </div>
    </>
  );
  const cls =
    "block bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-3 sm:p-4";
  if (!linked) return <div className={cls}>{body}</div>;
  const card = (
    <Link
      href={matchPath(view.tournamentId, view.id)}
      className={`${cls} hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors`}
      aria-label={`${view.sides[0].label} versus ${view.sides[1].label}, ${view.categoryLabel} ${view.roundName}, ${view.statusLabel}${summary ? `, ${summary}` : ""}${view.court ? `, ${courtLabel(view.court)}` : ""}`}
    >
      {body}
    </Link>
  );
  if (!share) return card;
  return (
    <div className="relative">
      {card}
      <div className="absolute bottom-1 right-1">
        <ShareResultButton view={view} variant="icon" />
      </div>
    </div>
  );
}

/**
 * Last-n form chips (FotMob/BWF style), newest on the left. Letter and colour
 * together (never colour alone); walkovers are lighter and read "W/O"/"L/O".
 */
export function FormChips({
  entries,
  loading = false,
  size = "sm",
}: {
  entries: FormEntry[] | undefined;
  loading?: boolean;
  size?: "sm" | "md";
}) {
  if (loading) {
    return (
      <span className="inline-flex gap-1" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 motion-safe:animate-pulse" />
        ))}
      </span>
    );
  }
  if (!entries || entries.length === 0) {
    return <span className="text-xs text-muted-foreground">No completed tournament matches yet</span>;
  }
  const wins = entries.filter((e) => e.result === "W").length;
  const box = size === "md" ? "min-w-6 h-6 text-xs" : "min-w-5 h-5 text-[10px]";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">
        Won {wins} of last {entries.length} tournament matches.
      </span>
      {entries.map((e) => {
        const won = e.result === "W";
        const tone = e.walkover
          ? won
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
          : won
            ? "bg-emerald-600 text-white"
            : "bg-rose-600 text-white";
        const date = e.date
          ? new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
          : null;
        const title = `${won ? "Won" : "Lost"}${e.walkover ? " (walkover)" : ""} vs ${e.opponentLabel}${e.eventLabel ? `, ${e.eventLabel}` : ""}${date ? `, ${date}` : ""}`;
        return (
          <Link
            key={e.matchId}
            href={matchPath(e.tournamentId, e.matchId)}
            title={title}
            aria-label={title}
            className={`${box} px-1 inline-flex items-center justify-center rounded font-black tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tone}`}
          >
            {e.walkover ? `${e.result}/O` : e.result}
          </Link>
        );
      })}
    </span>
  );
}
