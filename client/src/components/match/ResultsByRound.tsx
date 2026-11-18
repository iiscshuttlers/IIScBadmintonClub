import { useId, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { DISCIPLINES } from "@/lib/tournamentRoutes";
import { DISCIPLINE_LABELS, type MatchView } from "@/lib/matchView";
import { groupByStageDesc, type RoundStage } from "@/lib/roundOrder";
import { MatchScorecard } from "@/components/match/MatchPrimitives";

/**
 * Results list read the way a draw is followed: Final first, then 3rd place,
 * Semi-finals, Quarter-finals and back to the first round. A chip row jumps
 * to a round; rounds before the quarter-finals start collapsed. BYE "matches"
 * aren't games, so they become one line per round instead of score cards.
 */

const DISC_RANK = new Map<string, number>(DISCIPLINES.map((d, i) => [d, i]));
/** Rounds up to and including the quarter-finals start open. */
const OPEN_UP_TO_RANK = 2;

const eventKey = (v: MatchView) => v.discipline ?? v.categoryLabel ?? "";
const eventLabel = (v: MatchView) => (v.discipline ? DISCIPLINE_LABELS[v.discipline] : v.categoryLabel || "Matches");

function compareInStage(a: MatchView, b: MatchView): number {
  const da = DISC_RANK.get(a.discipline ?? "") ?? 99;
  const db = DISC_RANK.get(b.discipline ?? "") ?? 99;
  if (da !== db) return da - db;
  const ca = a.categoryLabel ?? "";
  const cb = b.categoryLabel ?? "";
  if (ca !== cb) return ca.localeCompare(cb);
  return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
}

/** The side that went through on a bye, or null when this isn't a bye. */
function byeAdvancer(v: MatchView): string | null {
  const [s1, s2] = v.sides;
  if (s1.isBye === s2.isBye) return null;
  const through = s1.isBye ? s2 : s1;
  return through.isTbd ? null : through.label;
}

interface StageSection {
  stage: RoundStage;
  events: Array<{ key: string; label: string; items: MatchView[] }>;
  byes: string[];
  count: number;
}

export function ResultsByRound({
  views,
  emptyTitle = "No results yet",
  emptyHint,
  linked = true,
  showShare = true,
}: {
  views: MatchView[];
  emptyTitle?: string;
  emptyHint?: string;
  linked?: boolean;
  showShare?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [query, setQuery] = useState("");
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  const sections = useMemo<StageSection[]>(() => {
    const sorted = [...views].sort(compareInStage);
    return groupByStageDesc(sorted, eventKey).map(({ stage, items }) => {
      const byes: string[] = [];
      const events = new Map<string, { key: string; label: string; items: MatchView[] }>();
      for (const v of items) {
        const through = byeAdvancer(v);
        if (through) {
          if (!q || through.toLowerCase().includes(q)) byes.push(through);
          continue;
        }
        if (v.sides[0].isBye && v.sides[1].isBye) continue;
        if (q && !v.sides.some((s) => s.label.toLowerCase().includes(q))) continue;
        const key = eventKey(v);
        let ev = events.get(key);
        if (!ev) {
          ev = { key, label: eventLabel(v), items: [] };
          events.set(key, ev);
        }
        ev.items.push(v);
      }
      const evList = Array.from(events.values());
      return { stage, events: evList, byes, count: evList.reduce((n, e) => n + e.items.length, 0) };
    }).filter((s) => s.count > 0 || s.byes.length > 0);
  }, [views, q]);

  const isOpen = (s: StageSection) => (q ? true : openState[s.stage.key] ?? (s.stage.rank <= OPEN_UP_TO_RANK || sections.length <= 3));
  const sectionId = (s: StageSection) => `${uid}-stage-${s.stage.key.replace(/[^a-z0-9]/gi, "_")}`;

  const jumpTo = (s: StageSection) => {
    setOpenState((prev) => ({ ...prev, [s.stage.key]: true }));
    requestAnimationFrame(() => document.getElementById(sectionId(s))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (views.length === 0) {
    return (
      <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
        <p className="font-black text-slate-700 dark:text-slate-200">{emptyTitle}</p>
        {emptyHint && <p className="text-sm text-muted-foreground mt-1">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a player's matches"
          aria-label="Search results by player"
          className="w-full min-h-[44px] bg-white dark:bg-slate-900 text-foreground text-sm font-semibold rounded-xl pl-10 pr-10 outline-none border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary placeholder:text-slate-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        )}
      </div>

      {sections.length > 1 && (
        <nav
          aria-label="Jump to round"
          className="sticky top-[48px] lg:top-[88px] z-20 -mx-1 px-1 py-2 bg-background/90 backdrop-blur-md"
        >
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {sections.map((s) => (
              <button
                key={s.stage.key}
                type="button"
                onClick={() => jumpTo(s)}
                className="shrink-0 min-h-[36px] px-3.5 rounded-full text-xs font-black bg-muted text-foreground hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                title={s.stage.label}
              >
                {s.stage.short}
                <span className="ml-1.5 font-bold text-muted-foreground tabular-nums">{s.count}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {sections.length === 0 ? (
        <p className="text-center py-8 text-sm font-semibold text-muted-foreground">No matches for “{query.trim()}”.</p>
      ) : (
        sections.map((s) => {
          const open = isOpen(s);
          const id = sectionId(s);
          const multiEvent = s.events.length > 1;
          return (
            <section key={s.stage.key} id={id} aria-labelledby={`${id}-h`} className="scroll-mt-[110px] lg:scroll-mt-[150px]">
              <h3 id={`${id}-h`}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`${id}-body`}
                  onClick={() => setOpenState((prev) => ({ ...prev, [s.stage.key]: !open }))}
                  className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="text-sm font-black uppercase tracking-wider text-foreground">{s.stage.label}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">
                    {s.count} {s.count === 1 ? "match" : "matches"}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                </button>
              </h3>
              {open && (
                <div id={`${id}-body`} className="mt-1 space-y-4">
                  {/* One grid per round so single-match events (Finals) sit side
                      by side; an event heading only when it has a run of cards. */}
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {s.events.flatMap((ev) => [
                      ...(multiEvent && ev.items.length > 1
                        ? [
                            <li key={`${ev.key}-h`} className="col-span-full pt-1 first:pt-0">
                              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground px-1">{ev.label}</p>
                            </li>,
                          ]
                        : []),
                      ...ev.items.map((v) => (
                        <li key={v.id} className="min-w-0">
                          <MatchScorecard view={v} linked={linked} showShare={showShare} hideRound />
                        </li>
                      )),
                    ])}
                  </ul>
                  {s.byes.length > 0 && (
                    <details className="px-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-bold select-none min-h-[32px] flex items-center">
                        {s.byes.length} {s.byes.length === 1 ? "entry" : "entries"} advanced on a bye
                      </summary>
                      <p className="mt-1 leading-relaxed text-foreground/80">{s.byes.join(" · ")}</p>
                    </details>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
