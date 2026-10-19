/**
 * Build a base-relative return URL for post-sign-in redirects.
 *
 * wouter's Router is configured with `base = BASE_URL` (e.g. "/IIScBadmintonClub"
 * on GitHub Pages), and `setLocation(path)` prepends that base itself. So the
 * stored return_url must be WITHOUT the base — otherwise after sign-in wouter
 * builds "/IIScBadmintonClub/IIScBadmintonClub/club", which matches no route and
 * renders the 404 page.
 *
 * `window.location.pathname` includes the base, so we strip it here. On native
 * (Capacitor) BASE_URL is "/", so nothing is stripped.
 */
export function getReturnUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = window.location.pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  return (path || "/") + window.location.search + window.location.hash;
}
