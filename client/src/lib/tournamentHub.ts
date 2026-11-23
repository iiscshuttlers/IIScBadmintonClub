/**
 * Pure helpers behind the /tournaments hub: which tournament takes the hero
 * spot, the status counts, filtering and sorting, and live-score formatting.
 */

export type HubStatusFilter = "all" | "active" | "upcoming" | "completed";
export type HubTypeFilter = "all" | "open" | "team";
export type HubRankedFilter = "all" | "ranked" | "casual";
export type HubSort = "date_desc" | "date_asc" | "name_asc";

export interface HubFilters {
  status: HubStatusFilter;
  type: HubTypeFilter;
  ranked: HubRankedFilter;
  search: string;
  sort: HubSort;
}

export const DEFAULT_HUB_FILTERS: HubFilters = {
  status: "all",
  type: "all",
  ranked: "all",
  search: "",
  sort: "date_desc",
};

export interface HubTournament {
  id: string;
  name?: string | null;
  status?: string | null;
  startDate?: string | null;
  created_at?: string | null;
  venue?: string | null;
  categories?: string[] | null;
  tournament_type?: string | null;
  counts_for_elo?: boolean | null;
}

/** Finished tournaments: completed, or completed and then archived. */
export const isPastStatus = (s: string | null | undefined) => s === "completed" || s === "archived";

/** Archived is an admin step (saved to Legacy); viewers just see Completed. */
export const displayStatus = (s: string | null | undefined) => (s === "archived" ? "completed" : s ?? "");

const startTime = (t: HubTournament) => new Date(t.startDate || t.created_at || 0).getTime();

/**
 * The hero spot: a live tournament first, else the soonest upcoming one
 * (dated ones before undated). A finished tournament never takes it; the
 * newest result leads the Results list instead.
 */
export function pickFeaturedTournament<T extends HubTournament>(list: T[]): T | null {
  const live = list.find((t) => t.status === "active");
  if (live) return live;
  const upcomingTime = (t: T) => (t.startDate ? new Date(t.startDate).getTime() : Number.POSITIVE_INFINITY);
  const upcoming = list
    .filter((t) => t.status === "upcoming")
    .sort((a, b) => upcomingTime(a) - upcomingTime(b));
  return upcoming[0] ?? null;
}

export function countByStatus(list: HubTournament[]) {
  const c = { all: list.length, active: 0, upcoming: 0, completed: 0 };
  list.forEach((t) => {
    if (t.status === "active") c.active++;
    else if (t.status === "upcoming") c.upcoming++;
    else if (isPastStatus(t.status)) c.completed++;
  });
  return c;
}

/** True when anything narrows the list (sort order alone does not). */
export function hasActiveFilters(f: HubFilters): boolean {
  return f.status !== "all" || f.type !== "all" || f.ranked !== "all" || f.search.trim() !== "";
}

export function filterTournaments<T extends HubTournament>(list: T[], f: HubFilters): T[] {
  let out = list;
  if (f.status === "completed") out = out.filter((t) => isPastStatus(t.status));
  else if (f.status !== "all") out = out.filter((t) => t.status === f.status);
  if (f.type !== "all") out = out.filter((t) => t.tournament_type === f.type);
  if (f.ranked !== "all") out = out.filter((t) => (f.ranked === "ranked" ? !!t.counts_for_elo : !t.counts_for_elo));
  const q = f.search.trim().toLowerCase();
  if (q) {
    out = out.filter((t) =>
      [t.name, t.venue, (t.categories ?? []).join(" ")].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }
  return [...out].sort((a, b) => {
    if (f.sort === "name_asc") return (a.name || "").localeCompare(b.name || "");
    return f.sort === "date_asc" ? startTime(a) - startTime(b) : startTime(b) - startTime(a);
  });
}

/** Splits a list into the hub's three groups, keeping each group's order. */
export function groupByStatus<T extends HubTournament>(list: T[]) {
  return {
    active: list.filter((t) => t.status === "active"),
    upcoming: list.filter((t) => t.status === "upcoming"),
    past: list.filter((t) => isPastStatus(t.status)),
  };
}

/** Lower-cased names that appear more than once, so cards can add the date. */
export function duplicateNames(list: HubTournament[]): Set<string> {
  const seen = new Map<string, number>();
  list.forEach((t) => {
    const key = (t.name || "").trim().toLowerCase();
    if (key) seen.set(key, (seen.get(key) || 0) + 1);
  });
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

export interface ScoreSet {
  s1: number | string;
  s2: number | string;
}

/**
 * Per-game scores from `tournament_matches.score`, which is a string such as
 * "21-13, 18-21" (older rows may hold `{ sets }` or `{ current }` objects).
 */
export function parseScoreSets(score: unknown): ScoreSet[] {
  if (!score) return [];
  if (typeof score === "string") {
    return score
      .split(",")
      .map((part) => part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ s1: Number(m[1]), s2: Number(m[2]) }));
  }
  const obj = score as { sets?: any[]; current?: any };
  if (Array.isArray(obj.sets) && obj.sets.length > 0) {
    return obj.sets.map((s) => ({ s1: s.team1 ?? s.side1 ?? 0, s2: s.team2 ?? s.side2 ?? 0 }));
  }
  if (obj.current) return [{ s1: obj.current.team1 ?? 0, s2: obj.current.team2 ?? 0 }];
  return [];
}

/** One-line score for a card, e.g. "21-13, 18-21"; free text passes through. */
export function formatScoreLine(score: unknown): string {
  const sets = parseScoreSets(score);
  if (sets.length > 0) return sets.map((s) => `${s.s1}-${s.s2}`).join(", ");
  return typeof score === "string" ? score : "";
}

/** "Starts in 5 days" / "Starts tomorrow" / "Starts today" for an upcoming tournament; null otherwise. */
export function startsInLabel(t: { status?: string | null; startDate?: string | null }, now: Date = new Date()): string | null {
  if (t.status !== "upcoming" || !t.startDate) return null;
  const today = new Date(now).setHours(0, 0, 0, 0);
  const start = new Date(t.startDate).setHours(0, 0, 0, 0);
  const days = Math.ceil((start - today) / 86400000);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

const fullDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Short date range without repeats: "16–18 Oct 2026", "28 Nov – 2 Dec 2026",
 * "30 Dec 2026 – 2 Jan 2027". Dates are `YYYY-MM-DD` columns, read in UTC so
 * the day never shifts with the viewer's time zone.
 */
export function formatDateRange(start?: string | null, end?: string | null): string | null {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const valid = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());
  if (!valid(s) || !valid(e)) return valid(s) ? fullDate(s) : valid(e) ? fullDate(e) : null;
  if (fullDate(s) === fullDate(e)) return fullDate(s);
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    if (s.getUTCMonth() === e.getUTCMonth()) return `${s.getUTCDate()}–${fullDate(e)}`;
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })} – ${fullDate(e)}`;
  }
  return `${fullDate(s)} – ${fullDate(e)}`;
}
