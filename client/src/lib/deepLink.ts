/**
 * Turns a URL Android handed to the app (App Link or custom scheme) into the
 * in-app route, so the exact page that was shared opens.
 *
 * Handles:
 *   https://iiscshuttlers.github.io/IIScBadmintonClub/<path>?<query>#<hash>
 *   iiscshuttlers://<path>?<query>#<hash>   (QR codes, NFC, Quick Settings tile)
 *
 * Returns null for any other URL so the caller can ignore it.
 */

export const PUBLIC_SITE_HOST = "iiscshuttlers.github.io";
export const PUBLIC_SITE_BASE = "/IIScBadmintonClub";
export const APP_SCHEME = "iiscshuttlers";

/** Characters a route, query or hash may keep; everything else is dropped. */
const UNSAFE_CHARS = /[^a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g;

function finalize(path: string): string {
  const safe = path.replace(UNSAFE_CHARS, "");
  const withSlash = safe.startsWith("/") ? safe : `/${safe}`;
  // There is no /login-callback route; OAuth returns land on home once the
  // session has been picked up from the hash.
  if (/^\/login-callback(?:[/?#]|$)/i.test(withSlash)) return "/";
  return withSlash;
}

export function appPathFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const url = rawUrl.trim();

  const schemePrefix = `${APP_SCHEME}://`;
  if (url.toLowerCase().startsWith(schemePrefix)) {
    return finalize(url.slice(schemePrefix.length));
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.hostname.toLowerCase() !== PUBLIC_SITE_HOST) return null;

  const base = PUBLIC_SITE_BASE.toLowerCase();
  const pathname = parsed.pathname;
  const lower = pathname.toLowerCase();
  if (lower !== base && !lower.startsWith(`${base}/`)) return null;

  let rest = pathname.slice(PUBLIC_SITE_BASE.length) || "/";
  if (/^\/index\.html$/i.test(rest)) rest = "/";
  return finalize(rest + parsed.search + parsed.hash);
}
