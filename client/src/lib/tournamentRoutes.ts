/**
 * Canonical tournament and match URLs (WP5).
 *
 * Decision record: docs/decisions/wp5-canonical-routes.md
 *
 *   /tournaments/:tournamentId[/:tab][?cat=&court=&date=&status=&panel=]
 *   /tournaments/:tournamentId/matches/:matchId
 *   /matches/:matchId   (short form; resolved to the canonical URL)
 *
 * Paths are returned without the deployment base (wouter's <Router base>
 * adds it), so they can be passed to `setLocation` / `<Link href>` directly.
 */

export const TOURNAMENT_TABS = ["overview", "players", "draw", "schedule", "results", "stats", "live"] as const;
export type TournamentTab = (typeof TOURNAMENT_TABS)[number];

/** Role- or viewer-specific sub-views, addressed with `?panel=`. */
export const TOURNAMENT_PANELS = ["my-matches", "my-entry", "polls", "umpire", "referee", "organizer"] as const;
export type TournamentPanel = (typeof TOURNAMENT_PANELS)[number];

/** Match page sub-tabs (`/tournaments/:id/matches/:matchId/:mtab`). No tab = Summary. */
export const MATCH_TABS = ["summary", "points", "h2h", "info"] as const;
export type MatchTab = (typeof MATCH_TABS)[number];

export const DISCIPLINES = ["MS", "WS", "MD", "WD", "XD"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export type MatchListStatus = "upcoming" | "completed";

export interface TournamentRouteFilters {
  cat?: Discipline | null;
  court?: string | null;
  /** ISO date, YYYY-MM-DD. */
  date?: string | null;
  status?: MatchListStatus | null;
  panel?: TournamentPanel | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function parseTournamentTab(raw: string | null | undefined): TournamentTab | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  return (TOURNAMENT_TABS as readonly string[]).includes(v) ? (v as TournamentTab) : null;
}

export function parseTournamentPanel(raw: string | null | undefined): TournamentPanel | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  return (TOURNAMENT_PANELS as readonly string[]).includes(v) ? (v as TournamentPanel) : null;
}

/** Accepts MS/WS/MD/WD/XD in any case; anything else (including "ALL") is no filter. */
export function parseDiscipline(raw: string | null | undefined): Discipline | null {
  if (!raw) return null;
  const v = raw.toUpperCase();
  return (DISCIPLINES as readonly string[]).includes(v) ? (v as Discipline) : null;
}

/**
 * `?cat=` for registration views: any of the tournament's own categories
 * (case-insensitive, returned as the tournament spells it). Match filters keep
 * using parseDiscipline / DISCIPLINES.
 */
export function parseCategory(search: string | URLSearchParams, categories: readonly string[] | null | undefined): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const raw = params.get("cat")?.trim();
  if (!raw) return null;
  return (categories ?? []).find((c) => c.toLowerCase() === raw.toLowerCase()) ?? null;
}

/** "My entry" for a tournament, optionally opened at one category. */
export function myEntryPath(tournamentId: string, category?: string | null): string {
  const q = new URLSearchParams({ panel: "my-entry" });
  if (category) q.set("cat", category);
  return `/tournaments/${encodeURIComponent(tournamentId)}?${q.toString()}`;
}

export function parseMatchListStatus(raw: string | null | undefined): MatchListStatus | null {
  return raw === "upcoming" || raw === "completed" ? raw : null;
}

/** Parse and validate every query-string value owned by the tournament route. */
export function parseTournamentRouteFilters(search: string | URLSearchParams): TournamentRouteFilters {
  const params = typeof search === "string"
    ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
    : search;
  return {
    panel: parseTournamentPanel(params.get("panel")),
    cat: parseDiscipline(params.get("cat")),
    court: params.get("court"),
    date: params.get("date") && ISO_DATE_RE.test(params.get("date")!) ? params.get("date") : null,
    status: parseMatchListStatus(params.get("status")),
  };
}

/**
 * Tab shown when the URL names none. An explicit tab is always honoured so
 * bookmarks keep working as the tournament moves through its lifecycle.
 */
export function defaultTabForStatus(status: string | null | undefined): TournamentTab {
  switch (status) {
    case "active":
      return "live";
    case "completed":
    case "archived":
      return "results";
    default:
      return "overview";
  }
}

/** Live is only offered in navigation while play is under way, or when the URL asks for it. */
export function isLiveTabOffered(status: string | null | undefined, currentTab: TournamentTab): boolean {
  return status === "active" || currentTab === "live";
}

function buildQuery(filters: TournamentRouteFilters | undefined): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.panel) params.set("panel", filters.panel);
  const cat = parseDiscipline(filters.cat ?? null);
  if (cat) params.set("cat", cat);
  if (filters.court) params.set("court", String(filters.court));
  if (filters.date && ISO_DATE_RE.test(filters.date)) params.set("date", filters.date);
  const status = parseMatchListStatus(filters.status);
  if (status) params.set("status", status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function tournamentPath(
  tournamentId: string,
  tab?: TournamentTab | null,
  filters?: TournamentRouteFilters,
): string {
  const base = `/tournaments/${encodeURIComponent(tournamentId)}`;
  return `${tab ? `${base}/${tab}` : base}${buildQuery(filters)}`;
}

/**
 * Where "Manage" takes someone who runs a tournament. The Tournament Manager
 * (/tournament-admin) is admin-only, so a host or organiser who is not an
 * admin gets the tournament page's Organiser panel instead of Access Denied.
 */
export function tournamentManagePath(tournamentId: string, isAdmin: boolean): string {
  return isAdmin
    ? `/tournament-admin?id=${encodeURIComponent(tournamentId)}`
    : tournamentPath(tournamentId, null, { panel: "organizer" });
}

export function matchPath(tournamentId: string, matchId: string, tab?: MatchTab | null): string {
  const base = `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`;
  // Summary is the default and keeps the original, shorter URL.
  return tab && tab !== "summary" ? `${base}/${tab}` : base;
}

/** Unknown or missing tab → Summary. */
export function parseMatchTab(raw: string | null | undefined): MatchTab {
  const t = (raw ?? "").toLowerCase();
  return (MATCH_TABS as readonly string[]).includes(t) ? (t as MatchTab) : "summary";
}

/** Short match URL for callers that only know the match ID (push payloads, shares). */
export function matchShortPath(matchId: string): string {
  return `/matches/${encodeURIComponent(matchId)}`;
}

/**
 * Link for a tournament card. Legacy JSON-archive events (no DB UUID) keep
 * their `/events/:slug` URL; every DB tournament uses the canonical route.
 */
export function tournamentLink(t: { id?: string | null; slug?: string | null }): string {
  if (isUuid(t.id)) return tournamentPath(t.id);
  const key = t.slug || t.id || "";
  return `/events/${encodeURIComponent(key)}`;
}

// ── Legacy mapping ──────────────────────────────────────────────────────────

type LegacySubTab =
  | "details" | "matches" | "polls" | "schedule" | "umpire" | "brackets"
  | "my-matches" | "standings" | "ties" | "organizer" | "referee";

/** Maps the old LiveTab `subtab` (+ `m_status`) to a canonical tab and optional panel. */
export function mapLegacySubTab(
  subtab: string | null | undefined,
  matchStatus: string | null | undefined,
  tournamentStatus?: string | null,
): { tab: TournamentTab | null; panel: TournamentPanel | null } {
  const st = (subtab ?? "") as LegacySubTab | "";
  switch (st) {
    case "details":
      return { tab: "overview", panel: null };
    case "brackets":
    case "ties":
    case "standings":
      return { tab: "draw", panel: null };
    case "schedule":
      return { tab: "schedule", panel: null };
    case "my-matches":
    case "polls":
    case "umpire":
    case "referee":
    case "organizer":
      return { tab: null, panel: st };
    case "matches":
    case "":
    default: {
      if (matchStatus === "completed") return { tab: "results", panel: null };
      const known = tournamentStatus != null;
      if (matchStatus === "upcoming") {
        // The old view listed upcoming matches; without a known status keep that view (Live).
        return { tab: !known || tournamentStatus === "active" ? "live" : "schedule", panel: null };
      }
      // No status: an explicit "matches" with a known lifecycle picks Live/Results;
      // otherwise let the lifecycle default decide.
      if (st === "matches" && known) {
        return { tab: tournamentStatus === "active" ? "live" : "results", panel: null };
      }
      return { tab: null, panel: null };
    }
  }
}

/**
 * `/tournaments?id=X&subtab=…&m_status=…&m_cat=…` → canonical path, or null
 * when the query does not identify a tournament.
 */
export function canonicalFromHubQuery(search: string, tournamentStatus?: string | null): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = params.get("id") || params.get("tournament_id");
  if (!id) return null;
  const { tab, panel } = mapLegacySubTab(params.get("subtab"), params.get("m_status"), tournamentStatus);
  return tournamentPath(id, tab, {
    panel,
    cat: parseDiscipline(params.get("m_cat") ?? params.get("cat")),
  });
}

/**
 * Pulse deep links that really point at one tournament or match:
 *   `/pulse?id=X…`                → `/tournaments/X/live` (subtab/m_status honoured)
 *   `/pulse?…#match-card-<matchId>` → `/matches/<matchId>`
 * Returns null for club-wide Pulse URLs; lib/sectionRedirects sends those on.
 */
export function canonicalFromPulse(search: string, hash: string): string | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (h.startsWith("match-card-")) {
    const matchId = h.slice("match-card-".length);
    if (matchId) return matchShortPath(matchId);
  }
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = params.get("id") || params.get("tournament_id");
  if (!id) return null;
  const hasLegacyTab = params.has("subtab") || params.has("m_status");
  if (!hasLegacyTab) return tournamentPath(id, "live", { cat: parseDiscipline(params.get("m_cat")) });
  return canonicalFromHubQuery(search, "active");
}

// ── Old LiveTab sub-tab ⇄ canonical tab (used by the embedded LiveTab) ─────

export type LiveSubTab = LegacySubTab | "players" | "stats" | "my-entry";

export function liveSubTabFor(
  tab: TournamentTab,
  panel: TournamentPanel | null,
  isTeam: boolean,
): LiveSubTab {
  if (panel) return panel;
  switch (tab) {
    case "overview":
      return "details";
    case "players":
      return "players";
    case "draw":
      return isTeam ? "ties" : "brackets";
    case "schedule":
      return "schedule";
    case "stats":
      return "stats";
    case "results":
    case "live":
      return "matches";
  }
}

export function canonicalForLiveSubTab(
  sub: LiveSubTab,
  currentTab: TournamentTab,
): { tab: TournamentTab; panel: TournamentPanel | null } {
  switch (sub) {
    case "details":
      return { tab: "overview", panel: null };
    case "players":
      return { tab: "players", panel: null };
    case "brackets":
    case "ties":
    case "standings":
      return { tab: "draw", panel: null };
    case "schedule":
      return { tab: "schedule", panel: null };
    case "matches":
      return { tab: currentTab === "results" ? "results" : "live", panel: null };
    case "stats":
      return { tab: "stats", panel: null };
    default:
      return { tab: currentTab, panel: sub };
  }
}
