/**
 * Page-view analytics (simplification plan, 22 Nov 2026): one `page_view`
 * event per screen a signed-in member opens, so the club can see which
 * screens are used before hiding anything. Only the route *shape* is sent —
 * ids, slugs, tokens, query strings and hashes are stripped.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^\d+$/;
/** Long opaque values (invite tokens, codes): 16+ chars mixing letters and digits. */
const TOKEN = /^(?=.*\d)(?=.*[a-z])[a-z0-9_-]{16,}$/i;

/** Routes whose parameters are not ids by shape (slugs, codes, pairs). */
const PARAM_ROUTES: [RegExp, string][] = [
  [/^\/join-team\/[^/]+/, "/join-team/:token"],
  [/^\/verify\/[^/]+/, "/verify/:code"],
  [/^\/events\/[^/]+/, "/events/:slug"],
  [/^\/(compare|doubles)\/[^/]+\/[^/]+/, "/$1/:a/:b"],
  [/^\/player\/[^/]+/, "/player/:id"],
  [/^\/team-hub\/[^/]+/, "/team-hub/:id"],
  [/^\/tournament-setup\/[^/]+/, "/tournament-setup/:id"],
];

export function normaliseRoute(path: string): string {
  let p = path.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  for (const [re, replacement] of PARAM_ROUTES) {
    if (re.test(p)) {
      p = p.replace(re, replacement);
      break;
    }
  }
  const segments = p
    .split("/")
    .map((seg) => {
      if (!seg || seg.startsWith(":")) return seg;
      let s = seg;
      try { s = decodeURIComponent(seg); } catch { /* keep raw */ }
      return UUID.test(s) || NUMBER.test(s) || TOKEN.test(s) ? ":id" : seg;
    });
  const out = segments.join("/").replace(/\/+$/, "");
  return out || "/";
}
