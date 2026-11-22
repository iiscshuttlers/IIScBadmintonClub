/**
 * Where the old Pulse and Legacy URLs live after the nav regroup
 * (Home · Tournaments · Players · Club, 21 Nov 2026):
 *
 *   /pulse#live       → /tournaments (each tournament has its own Live tab)
 *   /pulse#feed…      → /club?tab=news (a shared #feed-<post> anchor is kept)
 *   /pulse#calendar   → /club?tab=calendar
 *   /pulse#directory  → /players?tab=directory (dir_* filters are kept)
 *   /pulse#h2h        → /players?tab=directory&dir_view=h2h
 *   /legacy#champions → /players?tab=champions
 *   /legacy#records   → /players?tab=records
 *   /legacy#albums    → /club?tab=gallery#albums (filter / photo are kept)
 *   /player/:id/personal/<section> → the matching profile tab (#MATCHES, #STATS, #TRAINING)
 *
 * Tournament- or match-scoped Pulse links are handled first by
 * LegacyPulseRedirect (canonicalFromPulse); these cover the rest. Old links
 * arrive from push notifications, bookmarks, shared posts and RoutePersistence.
 */

function cleanHash(hash: string): string {
  return hash.replace(/^#/, "");
}

/** Keep only the listed query params, in a stable order. */
function keepParams(search: string, keys: (key: string) => boolean): URLSearchParams {
  const from = new URLSearchParams(search);
  const out = new URLSearchParams();
  from.forEach((value, key) => {
    if (keys(key)) out.append(key, value);
  });
  return out;
}

function withQuery(path: string, params: URLSearchParams, hash = ""): string {
  const q = params.toString();
  return `${path}${q ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
}

export function pulseRedirectTarget(search: string, hash: string): string {
  const h = cleanHash(hash);

  if (h.startsWith("feed") || h.startsWith("announcements")) {
    const params = new URLSearchParams({ tab: "news" });
    return withQuery("/club", params, h.startsWith("feed-") ? h : "");
  }
  if (h.startsWith("calendar") || h.startsWith("events")) {
    return "/club?tab=calendar";
  }
  if (h.startsWith("directory") || h.startsWith("h2h")) {
    const params = new URLSearchParams({ tab: "directory" });
    keepParams(search, (k) => k.startsWith("dir_")).forEach((v, k) => params.append(k, v));
    // #h2h (Back target of the compare / doubles pages) opens the directory's H2H view.
    if (h.startsWith("h2h")) params.set("dir_view", "h2h");
    return withQuery("/players", params);
  }
  // #live, no hash, or anything unknown: Pulse opened on Live.
  return "/tournaments";
}

/**
 * Old Personal Space URLs (/player/:id/personal[/home|matches|stats/…|training])
 * → the profile tab that now holds that section: Matches, Stats, Training
 * (ACE), and Overview for its home page.
 */
export function personalRedirectTarget(pathname: string): string | null {
  const m = pathname.match(/^\/player\/([^/]+)\/personal(?:\/([^/]*))?/);
  if (!m) return null;
  const [, id, rawSection = ""] = m;
  const tab = ({ matches: "MATCHES", stats: "STATS", training: "TRAINING" } as Record<string, string>)[rawSection.toLowerCase()];
  return tab ? `/player/${id}#${tab}` : `/player/${id}`;
}

export function legacyRedirectTarget(search: string, hash: string): string {
  const h = cleanHash(hash);
  if (h === "champions") return "/players?tab=champions";
  if (h === "records") return "/players?tab=records";

  const galleryParams = keepParams(search, (k) => k === "filter" || k === "photo");
  const galleryTab = h === "albums" || h === "photos" || h === "videos" ? h : null;
  // A bare /legacy opened on Champions; a gallery filter or photo opened Albums.
  if (!galleryTab && galleryParams.toString() === "") return "/players?tab=champions";

  const params = new URLSearchParams({ tab: "gallery" });
  galleryParams.forEach((v, k) => params.append(k, v));
  return withQuery("/club", params, galleryTab ?? "albums");
}
