import { DISCIPLINE_LABELS, type MatchView } from "@/lib/matchView";

/**
 * Presentation grouping for match lists, modelled on how BWF results pages
 * and cricket/football score sites read: section headers per event and round
 * ("Men's Singles · Quarter-final"), and a horizontal day strip.
 *
 * Pure functions; input order is preserved inside and across groups so the
 * caller's sort (compareUpcoming / compareCompleted) stays authoritative.
 */

export interface MatchGroup {
  key: string;
  title: string;
  items: MatchView[];
}

function eventTitle(v: MatchView): string {
  const event = v.discipline ? DISCIPLINE_LABELS[v.discipline] : v.categoryLabel || "Matches";
  return v.roundName ? `${event} · ${v.roundName}` : event;
}

/**
 * Groups consecutive-by-first-appearance: a group is placed where its first
 * match appears in the sorted input, so the earliest/most-recent group leads.
 */
export function groupByEventRound(views: MatchView[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const v of views) {
    const key = `${v.discipline ?? v.categoryLabel}|${v.roundName}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, title: eventTitle(v), items: [] };
      groups.set(key, g);
    }
    g.items.push(v);
  }
  return Array.from(groups.values());
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today" / "Tomorrow" / "Yesterday", else "Sat 15 Nov". `day` is local YYYY-MM-DD. */
export function dayChipLabel(day: string, now: Date = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (n: number) => ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  if (day === offset(0)) return "Today";
  if (day === offset(1)) return "Tomorrow";
  if (day === offset(-1)) return "Yesterday";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Courts that currently host a live match (plain array, sorted naturally). */
export function liveCourts(views: Pick<MatchView, "state" | "court">[]): string[] {
  const set = new Set<string>();
  for (const v of views) if (v.state === "live" && v.court) set.add(v.court);
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Index of the game currently being played in a live match, else -1. */
export function currentGameIndex(v: Pick<MatchView, "state" | "games">): number {
  return v.state === "live" && v.games.length > 0 ? v.games.length - 1 : -1;
}
