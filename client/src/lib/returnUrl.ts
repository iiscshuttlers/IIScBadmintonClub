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
