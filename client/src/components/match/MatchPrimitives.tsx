import type React from "react";
import { Link } from "wouter";
import { Check } from "lucide-react";
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
  live: "bg-live text-live-foreground",
  scheduled: "bg-muted text-soft",
  unscheduled: "bg-muted text-muted-foreground",
  completed: "bg-success/20 text-success",
  walkover: "bg-warning/20 text-warning",
  cancelled: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

/** Status is always written out; colour is supplementary. */
export function MatchStatusBadge({ view }: { view: Pick<MatchView, "state" | "statusLabel"> }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${STATE_CLASS[view.state]}`}>
      {view.state === "live" && <span className="w-1.5 h-1.5 rounded-full bg-foreground motion-safe:animate-pulse" aria-hidden />}
      {view.statusLabel}
    </span>
  );
}

/**
 * Shuttlecock in flight (BWF style): three feathers fanning out with clear
 * gaps, the tied band and a rounded cork, tilted so the cork leads. Solid
 * fill in currentColor; three feathers (not more) so the gaps still show at
 * 16px. Decorative: callers add the words.
 */
export function ShuttleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {/* Drawn upright, then tilted 30° and scaled to fill the box, centred. */}
      <g transform="translate(12 12) scale(1.22) translate(-14.11 -10.56) rotate(30 12 12)">
        <path d="M9.8 14.4 5.5 4.2Q7.55 2.4 9.6 4.2L11 14.4Z" />
        <path d="M11.4 14.4 9.95 4.2Q12 2.4 14.05 4.2L12.6 14.4Z" />
        <path d="M13 14.4 14.4 4.2Q16.45 2.4 18.5 4.2L14.2 14.4Z" />
        <rect x="9" y="14" width="6" height="2" rx="0.6" />
        <path d="M9.2 16.6h5.6v.4a2.8 2.8 0 0 1-5.6 0Z" />
      </g>
    </svg>
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

/**
 * A side's name inside a one-line "A vs B" title (stats lists, records book).
 * Same treatment as MatchSideRow: winner bold and full colour, the other side softer.
 */
export function SideName({ label, won, decided }: { label: string; won: boolean; decided: boolean }) {
  if (!decided) return <span className="font-semibold">{label}</span>;
  // `relative` anchors the absolutely positioned sr-only text to this span, so a
  // `truncate` parent clips it. Unanchored, it sits where the cut-off name ends,
  // past the screen edge, and phones widen the page (and the fixed bottom nav) to fit.
  return (
    <span className={won ? "relative font-black text-foreground" : "font-medium text-soft"}>
      {label}
      {won && <span className="sr-only"> (winner)</span>}
    </span>
  );
}

/** "A vs B" with the winner styled apart; `winner` indexes `sides`, null when undecided. */
export function SidesVs({ sides, winner }: { sides: readonly [string, string]; winner: 0 | 1 | null }) {
  return (
    <>
      <SideName label={sides[0]} won={winner === 0} decided={winner != null} />
      <span className="text-muted-foreground font-medium"> vs </span>
      <SideName label={sides[1]} won={winner === 1} decided={winner != null} />
    </>
  );
}

/** One side: names (wrapping, not truncated), seed, winner text, per-game scores aligned. */
export function MatchSideRow({
  side,
  index,
  view,
  serving = false,
}: {
  side: MatchSide;
  index: 0 | 1;
  view: Pick<MatchView, "games" | "state">;
  /** Live only: this side serves the next rally. */
  serving?: boolean;
}) {
  // BWF/Cricbuzz-style: the game in progress is boxed so the live score reads first.
  const liveIdx = currentGameIndex(view);
  const nameClass = side.isWinner
    ? "font-black text-foreground"
    : side.isTbd || side.isBye
      ? "italic text-muted-foreground"
      : "font-medium text-soft";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex items-start gap-2">
        {/* Fixed-width slot so both names line up whether or not one won. */}
        <span className="w-4 shrink-0 pt-0.5" aria-hidden>
          {side.isWinner && <Check className="w-4 h-4 text-primary" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
          <span className={`break-words ${nameClass}`}>{side.label}</span>
          <SeedMark seed={side.seed} />
          {serving && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-live" title="Serving">
              <ShuttleIcon className="w-4 h-4" />
              Serve
            </span>
          )}
          {side.isWinner && <span className="sr-only">(winner)</span>}
        </span>
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
                    ? "font-black bg-danger/15 text-danger ring-1 ring-danger/40"
                    : mine > theirs
                      ? "font-black text-foreground"
                      : "text-muted-foreground"
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

type TimesView = Pick<MatchView, "scheduledAt" | "startedAt" | "endedAt" | "state">;

/**
 * Scheduled, actual start and actual finish as one line, or null when none
 * is known (callers then hide the row or say "Not recorded").
 */
export function matchTimesText(view: TimesView, compact = false): string | null {
  const parts: string[] = [];
  const scheduled = fmt(view.scheduledAt);
  const started = fmt(view.startedAt);
  const ended = fmt(view.endedAt);
  if (scheduled) parts.push(`Scheduled ${scheduled}`);
  else if (view.state === "unscheduled" || view.state === "scheduled") parts.push("No scheduled time");
  // Compact cards show the actual start only while live; finish time always.
  if (started && (!compact || view.state === "live")) parts.push(`Started ${started}`);
  if (ended) parts.push(`Finished ${ended}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Scheduled, actual start and actual finish shown separately; never invented. */
export function MatchTimes({ view, compact = false }: { view: TimesView; compact?: boolean }) {
  const text = matchTimesText(view, compact);
  if (!text) return null;
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/** Compact scorecard used by Match Centre, court queues and (incrementally) other surfaces. */
export function MatchScorecard({
  view,
  showCourt = true,
  linked = true,
  showShare = false,
  badges,
  footer,
  hideRound = false,
}: {
  view: MatchView;
  showCourt?: boolean;
  linked?: boolean;
  /** The surrounding list already heads the round (e.g. ResultsByRound). */
  hideRound?: boolean;
  /** Completed/walkover only: a share icon kept outside the link (no nested controls). */
  showShare?: boolean;
  /** Extra labels in the header row, e.g. "Match of the day", "Upset". Text, not interactive. */
  badges?: React.ReactNode;
  /** Interactive extras (e.g. polls) rendered below the card, outside the link. */
  footer?: React.ReactNode;
}) {
  const summary = scoreSummary(view);
  const share = showShare && canShareResult(view);
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        <span>{view.discipline ?? view.categoryLabel}</span>
        {view.roundName && !hideRound && <span>· {view.roundName}</span>}        {view.rubberLabel && <span>· {view.rubberLabel}</span>}
        {showCourt && view.court && <span>· {courtLabel(view.court)}</span>}
        {badges && <span className="normal-case tracking-normal inline-flex flex-wrap gap-1">{badges}</span>}
        {/* A finished match reads as finished from the check mark and scores;
            the pill is kept for states that need calling out. */}
        {view.state !== "completed" && (
          <span className="ml-auto normal-case tracking-normal">
            <MatchStatusBadge view={view} />
          </span>
        )}
      </div>
      <div className="mt-1 divide-y divide-border">
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
    "block bg-card rounded-2xl border border-border shadow-sm p-3 sm:p-4";
  if (!linked) return <div className={cls}>{body}{footer && <div className="mt-2">{footer}</div>}</div>;
  const card = (
    <Link
      href={matchPath(view.tournamentId, view.id)}
      className={`${cls} hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors`}
      aria-label={`${view.sides[0].label} versus ${view.sides[1].label}, ${view.categoryLabel} ${view.roundName}, ${view.statusLabel}${summary ? `, ${summary}` : ""}${view.court ? `, ${courtLabel(view.court)}` : ""}`}
    >
      {body}
    </Link>
  );
  if (!share && !footer) return card;
  return (
    <div>
      <div className="relative">
        {card}
        {share && (
          <div className="absolute bottom-1 right-1">
            <ShareResultButton view={view} variant="icon" />
          </div>
        )}
      </div>
      {footer && <div className="mt-1.5 px-1">{footer}</div>}
    </div>
  );
}

/**
 * Last-n form chips (FotMob/BWF style), newest on the left. Letter and colour
 * together (never colour alone). A walkover keeps its result's letter and
 * colour and adds a small "w/o" under the letter: badminton writes W/O for
 * the match itself, so "L/O" would mean nothing to players.
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
          <span key={i} className="w-5 h-6 rounded bg-muted motion-safe:animate-pulse" />
        ))}
      </span>
    );
  }
  if (!entries || entries.length === 0) {
    return <span className="text-xs text-muted-foreground">No completed tournament matches yet</span>;
  }
  const wins = entries.filter((e) => e.result === "W").length;
  const box = size === "md" ? "min-w-6 h-7 text-xs" : "min-w-5 h-6 text-[10px]";
  const woText = size === "md" ? "text-[8px]" : "text-[7px]";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">
        Won {wins} of last {entries.length} tournament matches.
      </span>
      {entries.map((e) => {
        const won = e.result === "W";
        const tone = won ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground";
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
            {e.walkover ? (
              <span className="flex flex-col items-center leading-none" aria-hidden>
                <span>{e.result}</span>
                <span className={`${woText} font-bold lowercase tracking-tight opacity-90`}>w/o</span>
              </span>
            ) : (
              e.result
            )}
          </Link>
        );
      })}
    </span>
  );
}
