import { parseTournamentTab, tournamentPath } from "@/lib/tournamentRoutes";

const TOURNAMENT_RETURN_PREFIX = "iiscshuttlers:tournament-return:";
const SCROLL_PREFIX = "iiscshuttlers:scroll:";

/** A stable app-relative route key, including filters and hash state. */
export function routeKey(pathname: string, search = "", hash = ""): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  const fragment = hash && !hash.startsWith("#") ? `#${hash}` : hash;
  return `${path}${query}${fragment}`;
}

/** Returns the tournament id only for a canonical tournament page, never a match page. */
export function tournamentIdForReturnRoute(route: string): string | null {
  const url = new URL(route, "https://app.invalid");
  const match = url.pathname.match(/^\/tournaments\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  if (match[2] && !parseTournamentTab(match[2])) return null;
  return decodeURIComponent(match[1]);
}

export function isTournamentReturnRoute(route: string, tournamentId: string): boolean {
  return tournamentIdForReturnRoute(route) === tournamentId;
}

export function rememberTournamentReturnRoute(route: string, storage: Storage = sessionStorage): void {
  const tournamentId = tournamentIdForReturnRoute(route);
  if (!tournamentId) return;
  try {
    storage.setItem(`${TOURNAMENT_RETURN_PREFIX}${tournamentId}`, route);
  } catch {
    // Storage may be unavailable in private browsing or a constrained WebView.
  }
}

export function tournamentReturnRoute(tournamentId: string, storage: Storage = sessionStorage): string {
  try {
    const saved = storage.getItem(`${TOURNAMENT_RETURN_PREFIX}${tournamentId}`);
    if (saved && isTournamentReturnRoute(saved, tournamentId)) return saved;
  } catch {
    // Fall through to the canonical tournament root.
  }
  return tournamentPath(tournamentId);
}

export function rememberScroll(route: string, y: number, storage: Storage = sessionStorage): void {
  if (!Number.isFinite(y) || y < 0) return;
  try {
    storage.setItem(`${SCROLL_PREFIX}${route}`, String(Math.round(y)));
  } catch {
    // Best-effort continuity only.
  }
}

export function recalledScroll(route: string, storage: Storage = sessionStorage): number | null {
  try {
    const raw = storage.getItem(`${SCROLL_PREFIX}${route}`);
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
