import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FEED_URL,
  mergeVideos,
  parseFeed,
  pickNewEntries,
  toSiteVideo,
  type SiteVideo,
  type SyncStatus,
} from "../_shared/youtubeFeed.ts";

/**
 * Adds new uploads from youtube.com/@iiscbadmintonclub to site_data "videos"
 * (the /legacy Videos tab). Runs hourly via pg_cron (migration
 * 20261121100000_youtube_video_sync.sql); admins can also run it from
 * Site Admin → Content → Videos → "Check now".
 *
 * Reads the channel's public RSS feed (latest 15 uploads, no API key). Videos
 * already in the list, hidden ones included, are never added again; Shorts are
 * skipped. The result of each run is saved to site_data "youtube_sync".
 * Safe to call any number of times: it only ever adds missing videos, and calls
 * within 30 s of the previous run return that run's status.
 */

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const STATUS_KEY = "youtube_sync";
const MIN_INTERVAL_MS = 30_000;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; club-video-sync)" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** youtube.com/shorts/<id> answers 200 for a Short and redirects to /watch otherwise. */
async function isShort(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      method: "HEAD",
      redirect: "manual",
      headers: UA,
    });
    await res.body?.cancel();
    return res.status === 200;
  } catch {
    return false; // can't tell: import it; an admin can hide it
  }
}

const asVideos = (v: unknown): SiteVideo[] => (Array.isArray(v) ? (v as SiteVideo[]) : []);

async function readVideos(): Promise<SiteVideo[]> {
  const { data, error } = await admin.from("site_data").select("value").eq("key", "videos").maybeSingle();
  if (error) throw new Error(`read videos: ${error.message}`);
  return asVideos(data?.value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const { data: statusRow } = await admin.from("site_data").select("value").eq("key", STATUS_KEY).maybeSingle();
  const prev = (statusRow?.value ?? {}) as Partial<SyncStatus>;
  if (prev.lastRunAt && Date.now() - Date.parse(prev.lastRunAt) < MIN_INTERVAL_MS) {
    return json({ added: [], status: prev, throttled: true });
  }

  const now = new Date().toISOString();
  const shortIds = new Set(prev.shortIds ?? []);
  let added: SiteVideo[] = [];
  let status: SyncStatus;

  try {
    const res = await fetch(FEED_URL, { headers: UA });
    if (!res.ok) throw new Error(`YouTube feed returned HTTP ${res.status}`);
    const entries = parseFeed(await res.text());
    if (entries.length === 0) throw new Error("YouTube feed had no videos (format change or consent page?)");

    for (const e of pickNewEntries(await readVideos(), entries, shortIds)) {
      if (await isShort(e.videoId)) shortIds.add(e.videoId);
      else added.push(toSiteVideo(e));
    }

    if (added.length > 0) {
      // Re-read just before writing so an admin save in the meantime isn't lost.
      const latest = await readVideos();
      const merged = mergeVideos(latest, added);
      added = merged.slice(0, merged.length - latest.length);
      const { error } = await admin
        .from("site_data")
        .upsert({ key: "videos", value: merged, updated_at: now }, { onConflict: "key" });
      if (error) throw new Error(`save videos: ${error.message}`);
    }

    status = {
      lastRunAt: now,
      ok: true,
      lastAddedCount: added.length,
      ...(added.length > 0 ? { lastAddedAt: now } : prev.lastAddedAt ? { lastAddedAt: prev.lastAddedAt } : {}),
      shortIds: [...shortIds].slice(-50),
    };
  } catch (err) {
    added = [];
    status = {
      lastRunAt: now,
      ok: false,
      lastError: err instanceof Error ? err.message : String(err),
      lastAddedCount: 0,
      ...(prev.lastAddedAt ? { lastAddedAt: prev.lastAddedAt } : {}),
      shortIds: [...shortIds].slice(-50),
    };
    console.error("sync-youtube-videos:", status.lastError);
  }

  await admin.from("site_data").upsert({ key: STATUS_KEY, value: status, updated_at: now }, { onConflict: "key" });
  // 200 either way: the caller reads status.ok / status.lastError.
  return json({ added: added.map((v) => ({ videoId: v.videoId, title: v.title })), status });
});
