import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink, Youtube, Eye, EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";

/** site_data "youtube_sync", written by the sync-youtube-videos edge function. */
type YoutubeSyncStatus = {
  lastRunAt: string;
  ok: boolean;
  lastError?: string;
  lastAddedCount: number;
  lastAddedAt?: string;
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM, h:mm a");
};

function YoutubeSyncPanel({ reload, isDirty }: { reload?: () => Promise<void>; isDirty?: boolean }) {
  const [status, setStatus] = useState<YoutubeSyncStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let live = true;
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "youtube_sync")
      .maybeSingle()
      .then(({ data }) => {
        if (live) setStatus((data?.value as YoutubeSyncStatus | undefined) ?? null);
      });
    return () => {
      live = false;
    };
  }, []);

  const checkNow = async () => {
    if (isDirty) {
      toast.error("Save or undo your changes first: checking YouTube reloads this list.");
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-youtube-videos", { body: { type: "admin" } });
      if (error) throw error;
      const next = data?.status as YoutubeSyncStatus | undefined;
      const added: { title: string }[] = data?.added ?? [];
      if (next) setStatus(next);
      if (next && !next.ok) toast.error(`YouTube check failed: ${next.lastError}`);
      else if (added.length > 0) toast.success(`Added ${added.length} new video${added.length === 1 ? "" : "s"} from YouTube`);
      else if (data?.throttled) toast("Checked less than a minute ago. Nothing new.");
      else toast("No new videos on YouTube.");
      if (added.length > 0) await reload?.();
    } catch (err) {
      toast.error("Couldn't reach the YouTube sync: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={`${cardCls} flex flex-col sm:flex-row sm:items-center gap-4`}>
      <Youtube className="w-6 h-6 text-danger shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-bold text-foreground">New YouTube uploads are added automatically</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every hour the site checks youtube.com/@iiscbadmintonclub and puts new videos at the top of this list.
          Shorts are skipped. Videos you hide stay hidden.
        </p>
        {status ? (
          <p className={`text-xs font-semibold mt-1.5 ${status.ok ? "text-muted-foreground" : "text-danger"}`}>
            {status.ok
              ? `Last checked ${fmtWhen(status.lastRunAt)}: ${
                  status.lastAddedCount > 0
                    ? `added ${status.lastAddedCount}`
                    : "nothing new"
                }${status.lastAddedAt ? `. Last new video ${fmtWhen(status.lastAddedAt)}.` : "."}`
              : `Last check failed (${fmtWhen(status.lastRunAt)}): ${status.lastError}`}
          </p>
        ) : (
          <p className="text-xs font-semibold mt-1.5 text-muted-foreground">Not checked yet.</p>
        )}
      </div>
      <button
        onClick={checkNow}
        disabled={checking}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 text-sm font-bold transition disabled:opacity-50 shrink-0"
      >
        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Check now
      </button>
    </div>
  );
}

export function VideoEditor({
  data,
  onChange,
  reload,
  isDirty,
}: {
  data: VideoItem[];
  onChange: (d: VideoItem[]) => void;
  reload?: () => Promise<void>;
  isDirty?: boolean;
}) {
  const add = () =>
    onChange([
      ...data,
      {
        id: `v${Date.now()}`,
        title: "",
        videoId: "",
        category: "",
        tournament: "",
        chapters: [],
      },
    ]);
  // A saved video is hidden, not deleted: deleting it would let the hourly
  // YouTube sync add it straight back.
  const remove = (i: number) =>
    data[i].videoId
      ? onChange(data.map((v, idx) => (idx === i ? { ...v, hidden: true } : v)))
      : onChange(data.filter((_, idx) => idx !== i));
  const restore = (i: number) =>
    onChange(data.map((v, idx) => (idx === i ? { ...v, hidden: false } : v)));
  const hiddenCount = data.filter((v) => v.hidden).length;
  const update = (i: number, field: string, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const parseVideoId = (input: string) => {
    const m = input.match(
      /(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/,
    );
    return m ? m[1] : input.trim();
  };

  const addChapter = (i: number) => {
    const chapters = [...(data[i].chapters ?? []), { time: 0, title: "" }];
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };
  const removeChapter = (i: number, ci: number) => {
    const chapters = (data[i].chapters ?? []).filter((_, idx) => idx !== ci);
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };
  const updateChapter = (
    i: number,
    ci: number,
    field: "time" | "title",
    val: string,
  ) => {
    const chapters = [...(data[i].chapters ?? [])];
    chapters[ci] = {
      ...chapters[ci],
      [field]: field === "time" ? parseTime(val) : val,
    };
    chapters.sort((a, b) => a.time - b.time);
    const next = [...data];
    next[i] = { ...next[i], chapters };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <YoutubeSyncPanel reload={reload} isDirty={isDirty} />

      {/* Admin Guide */}
      <div className="bg-primary/20 border border-primary/50 rounded-2xl p-5 text-sm text-primary/70">
        <h4 className="font-black flex items-center gap-2 mb-3 text-primary"><Activity className="w-5 h-5" /> Live Scoreboard & Scoring Mode Guide</h4>
        <ul className="list-disc list-inside space-y-2 opacity-90 marker:text-primary">
          <li><strong>Auto-Extracting Names:</strong> Name your video title with exactly this format: <code className="bg-muted px-1.5 py-0.5 rounded font-bold">Player A and Player B vs Player C and Player D || Match Title</code> to automatically populate the BWF player names on the live scoreboard. "&amp;" works in place of "and"; videos added from YouTube already use it.</li>
          <li><strong>Scoring a Match:</strong> Open any video in the front-end Gallery. Click the "Score Mode" toggle in the top right of the title bar. Click the player buttons as you watch to record timestamps.</li>
          <li><strong>Importing Scores:</strong> When finished, click the red "Copy JSON Data" button in the player. Come back here, find the video, and click the <strong>"Paste from Clipboard"</strong> button below to instantly attach the live scoreboard!</li>
        </ul>
      </div>

      {data.map((v, i) => v.hidden ? null : (
        <div key={i} className={`${cardCls} flex flex-col gap-4`}>
          <div className="flex flex-col lg:flex-row gap-4">
            {v.videoId && (
              <div className="w-full lg:w-48 aspect-video rounded-xl overflow-hidden bg-muted shrink-0">
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={`${labelCls} flex items-center gap-2`}>
                  Title
                  {v.source === "youtube" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/10 text-danger normal-case tracking-normal">
                      <Youtube className="w-3 h-3" /> Added from YouTube
                    </span>
                  )}
                </label>
                <input
                  value={v.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  className={inputCls}
                />
                {v.youtubeTitle && v.youtubeTitle !== v.title && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate" title={v.youtubeTitle}>
                    On YouTube: {v.youtubeTitle}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>YouTube URL or ID</label>
                <input
                  value={v.videoId}
                  onChange={(e) =>
                    update(i, "videoId", parseVideoId(e.target.value))
                  }
                  className={inputCls}
                  placeholder="Paste YouTube URL or video ID"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-end gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Category</label>
                  <input
                    value={v.category}
                    onChange={(e) => update(i, "category", e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Farewell Matches 2026"
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Tournament Tag</label>
                  <input
                    value={v.tournament || ""}
                    onChange={(e) => update(i, "tournament", e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Spectrum 2026"
                  />
                </div>
                <button
                  onClick={() => remove(i)}
                  title={v.videoId ? "Hide from the website" : "Remove"}
                  aria-label={v.videoId ? "Hide from the website" : "Remove"}
                  className="p-2 rounded-xl text-danger hover:bg-danger/10 transition mb-0.5"
                >
                  {v.videoId ? <EyeOff className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Chapter editor */}
          <div className="border-t border-border-strong pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>
                Chapters{" "}
                <span className="text-muted-foreground font-normal">
                  (optional — mark key moments)
                </span>
              </label>
              <button
                onClick={() => addChapter(i)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/30 text-primary hover:bg-primary/15 transition font-semibold"
              >
                <Plus className="w-3 h-3" /> Add chapter
              </button>
            </div>
            {(v.chapters ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No chapters yet.</p>
            )}
            <div className="space-y-2">
              {(v.chapters ?? []).map((ch, ci) => (
                <div key={ch.time} className="flex items-center gap-2">
                  <input
                    className={inputCls + " w-20 shrink-0 font-mono text-xs"}
                    placeholder="0:00"
                    defaultValue={fmtTime(ch.time)}
                    onBlur={(e) => updateChapter(i, ci, "time", e.target.value)}
                  />
                  <input
                    className={inputCls + " flex-1 text-sm"}
                    placeholder="Chapter title"
                    value={ch.title}
                    onChange={(e) =>
                      updateChapter(i, ci, "title", e.target.value)
                    }
                  />
                  <button
                    onClick={() => removeChapter(i, ci)}
                    className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Score Logs Importer */}
          <div className="border-t border-border-strong pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
            <div>
               <label className={labelCls + " mb-0"}>Live Scoreboard Data</label>
               <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{(v.scoreLogs ?? []).length} timestamps recorded.</p>
            </div>
            <div className="flex gap-2">
               <button onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed)) {
                       update(i, "scoreLogs", parsed as any);
                       toast.success("Live score data successfully imported!");
                    } else {
                       toast.error("Clipboard does not contain valid score data array.");
                    }
                  } catch(e) { toast.error("No valid JSON found in clipboard"); }
               }} className="text-xs font-bold px-4 py-2 rounded-xl bg-primary/40 text-primary hover:bg-primary/50 transition shadow-sm">
                 Paste from Clipboard
               </button>
               {v.scoreLogs && v.scoreLogs.length > 0 && (
                 <button onClick={() => update(i, "scoreLogs", undefined as any)} className="text-xs font-bold px-3 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/15 transition">
                   Clear
                 </button>
               )}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border-strong text-muted-foreground hover:border-primary hover:text-primary transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Video
      </button>

      {hiddenCount > 0 && (
        <details className="rounded-2xl border border-border-strong p-4">
          <summary className="cursor-pointer text-sm font-bold text-muted-foreground">
            Hidden from the website ({hiddenCount})
          </summary>
          <ul className="mt-3 space-y-2">
            {data.map((v, i) =>
              v.hidden ? (
                <li key={i} className="flex items-center gap-3">
                  <img
                    src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                    alt=""
                    className="w-20 aspect-video rounded-lg object-cover bg-muted shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">{v.title || v.videoId}</span>
                  <button
                    onClick={() => restore(i)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" /> Show again
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </details>
      )}
    </div>
  );
}


