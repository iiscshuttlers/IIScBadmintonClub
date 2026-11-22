/**
 * Pure logic for the YouTube auto-import (no Deno imports, so vitest covers it:
 * test/lib/youtubeFeed.test.ts). Used by supabase/functions/sync-youtube-videos.
 *
 * The channel's public RSS feed needs no API key but lists only the latest 15
 * uploads. Any upload the site has never seen is added to site_data "videos"
 * (Club → Gallery → Videos), newest first. A video already in that list — hidden
 * ones included — is never added again, so hiding it in the admin editor keeps
 * it off the site for good.
 */

export const CHANNEL_ID = "UCB1xwWZPS9CwqooTJprw6_Q"; // youtube.com/@iiscbadmintonclub
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface FeedEntry {
  videoId: string;
  title: string;
  publishedAt: string;
}

/** One entry of site_data "videos" (client type: VideoItem in admin/editors/shared.ts). */
export interface SiteVideo {
  id: string;
  title: string;
  videoId: string;
  category: string;
  tournament?: string;
  chapters?: { time: number; title: string }[];
  scoreLogs?: unknown[];
  /** Hidden by an admin: kept in the list so the sync won't re-add it. */
  hidden?: boolean;
  /** "youtube" when the sync added it. */
  source?: string;
  /** The title exactly as on YouTube (title holds the cleaned-up matchup). */
  youtubeTitle?: string;
  publishedAt?: string;
}

/** site_data "youtube_sync": what the last run did, shown in the admin editor. */
export interface SyncStatus {
  lastRunAt: string;
  ok: boolean;
  lastError?: string;
  lastAddedCount: number;
  lastAddedAt?: string;
  /** Shorts seen in the feed, remembered so they aren't re-checked every hour. */
  shortIds: string[];
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s
    .replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === "#") {
        const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? m;
    });
}

const tagText = (xml: string, tag: string) =>
  xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];

export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const body = m[1];
    const videoId = tagText(body, "yt:videoId")?.trim();
    const title = tagText(body, "title");
    if (!videoId || !/^[\w-]{11}$/.test(videoId) || title == null) continue;
    out.push({
      videoId,
      title: decodeXml(title).replace(/\s+/g, " ").trim(),
      publishedAt: tagText(body, "published")?.trim() ?? "",
    });
  }
  return out;
}

export interface ParsedTitle {
  /** "A & B vs C & D", or null when the title has no "vs". */
  matchup: string | null;
  /** e.g. "Men's Singles Semifinal". */
  event: string | null;
  /** e.g. "Open Tournament August 2026". */
  tournament: string | null;
}

const VS = /\s+vs\.?\s+/i;
const TOURNAMENT_HINT = /\b(19|20)\d{2}\b|tournament|championship|league|\bcup\b/i;

/**
 * Split the club's upload titles into matchup / event / tournament. Handles
 *   "A vs B | Men's Singles Semifinal | Open Tournament August 2026"
 *   "Men's Doubles Semifinal: A & B vs C & D"
 *   "Men's Singles Quarterfinal: A vs B | Open Tournament August 2026"
 *   "A vs B || WS Finals"
 * A "|" part with a year or "tournament"/"championship"/… is the tournament;
 * the first other part (or the "Event:" prefix) is the event.
 */
export function parseVideoTitle(raw: string): ParsedTitle {
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  const mi = parts.findIndex((p) => VS.test(p));
  if (mi === -1) return { matchup: null, event: null, tournament: null };

  let match = parts[mi];
  let event: string | null = null;
  const colon = match.indexOf(":");
  if (colon > 0 && colon < match.search(VS)) {
    event = match.slice(0, colon).trim() || null;
    match = match.slice(colon + 1).trim();
  }

  let tournament: string | null = null;
  parts.forEach((p, i) => {
    if (i === mi) return;
    if (!tournament && TOURNAMENT_HINT.test(p)) tournament = p;
    else if (!event) event = p;
  });

  const matchup = match.split(VS).map((s) => s.trim()).join(" vs ");
  return { matchup, event, tournament };
}

export function toSiteVideo(e: FeedEntry): SiteVideo {
  const { matchup, event, tournament } = parseVideoTitle(e.title);
  return {
    id: `yt-${e.videoId}`,
    title: matchup ?? e.title,
    videoId: e.videoId,
    category: event ?? "",
    ...(tournament ? { tournament } : {}),
    chapters: [],
    source: "youtube",
    youtubeTitle: e.title,
    publishedAt: e.publishedAt,
  };
}

const time = (iso: string | undefined) => Date.parse(iso ?? "") || 0;

/** Feed entries not yet in the list (or skipped as Shorts), newest first. */
export function pickNewEntries(
  existing: readonly SiteVideo[],
  entries: readonly FeedEntry[],
  skipIds: Iterable<string> = [],
): FeedEntry[] {
  const known = new Set(existing.map((v) => v.videoId));
  for (const id of skipIds) known.add(id);
  const picked: FeedEntry[] = [];
  for (const e of entries) {
    if (known.has(e.videoId)) continue;
    known.add(e.videoId);
    picked.push(e);
  }
  return picked.sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
}

/** New videos go on top; anything already in `existing` is left exactly as it is. */
export function mergeVideos(existing: readonly SiteVideo[], added: readonly SiteVideo[]): SiteVideo[] {
  const known = new Set(existing.map((v) => v.videoId));
  return [...added.filter((v) => !known.has(v.videoId)), ...existing];
}
