/**
 * Post-sign-in return addresses, relative to the router's base.
 *
 * wouter's Router runs with `base = BASE_URL` ("/IIScBadmintonClub" on GitHub
 * Pages, "" on native) and `setLocation(path)` prepends that base itself. A
 * stored return_url must therefore not include the base, or sign-in sends the
 * user to "/IIScBadmintonClub/IIScBadmintonClub/club", which matches no route
 * and shows the 404 page. `window.location.pathname` includes the base, so it
 * is stripped here.
 */

function routerBase(): string {
  // "./" on Capacitor builds and "/" elsewhere both mean "no base".
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base.startsWith("/") ? base : "";
}

/** Strip the router base from a path, if present. Leaves other paths alone. */
export function toAppPath(path: string): string {
  const base = routerBase();
  if (base && (path === base || path.startsWith(base + "/") || path.startsWith(base + "?") || path.startsWith(base + "#"))) {
    const rest = path.slice(base.length);
    return rest.startsWith("/") ? rest : "/" + rest;
  }
  return path || "/";
}

/** The current page as a base-relative return address. */
export function currentReturnUrl(): string {
  return toAppPath(window.location.pathname) + window.location.search + window.location.hash;
}

const RETURN_KEY = "return_url";

/** Remember where to come back to after sign-in (defaults to the current page). */
export function rememberReturnUrl(path: string = currentReturnUrl()): void {
  try { sessionStorage.setItem(RETURN_KEY, toAppPath(path)); } catch { /* storage blocked: sign-in just lands on home */ }
}

/**
 * Read and clear the stored return address. Only in-app paths ("/x", never
 * "//host" or "https://…") are honoured, so a crafted value can't send the
 * user off-site. Returns null when there is none.
 */
export function takeReturnUrl(): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch { /* storage blocked */ }
  const inApp = (p: string) => p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");
  if (!raw || !inApp(raw)) return null;
  const path = toAppPath(raw);
  return inApp(path) ? path : null;
}
