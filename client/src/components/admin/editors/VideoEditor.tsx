import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";
import { 
  Holiday, Announcement, EventItem, Chapter, VideoItem, Player, SiteConfig, FlyerItem, DynamicFlyer, AuthUser,
  inputCls, labelCls, cardCls, colorSwatchCls, toHex, parseTime, fmtTime
} from "./shared";

export function VideoEditor({
  data,
  onChange,
}: {
  data: VideoItem[];
  onChange: (d: VideoItem[]) => void;
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
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
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
      {/* Admin Guide */}
      <div className="bg-primary/10 dark:bg-primary/20 border border-primary/40 dark:border-primary/50 rounded-2xl p-5 text-sm text-primary dark:text-primary/70">
        <h4 className="font-black flex items-center gap-2 mb-3 text-primary dark:text-primary"><Activity className="w-5 h-5" /> Live Scoreboard & Scoring Mode Guide</h4>
        <ul className="list-disc list-inside space-y-2 opacity-90 marker:text-primary">
          <li><strong>Auto-Extracting Names:</strong> Name your video title with exactly this format: <code className="bg-black/10 dark:bg-black/30 px-1.5 py-0.5 rounded font-bold">Player A and Player B vs Player C and Player D || Match Title</code> to automatically populate the BWF player names on the live scoreboard.</li>
          <li><strong>Scoring a Match:</strong> Open any video in the front-end Gallery. Click the "Score Mode" toggle in the top right of the title bar. Click the player buttons as you watch to record timestamps.</li>
          <li><strong>Importing Scores:</strong> When finished, click the red "Copy JSON Data" button in the player. Come back here, find the video, and click the <strong>"Paste from Clipboard"</strong> button below to instantly attach the live scoreboard!</li>
        </ul>
      </div>

      {data.map((v, i) => (
        <div key={i} className={`${cardCls} flex flex-col gap-4`}>
          <div className="flex flex-col lg:flex-row gap-4">
            {v.videoId && (
              <div className="w-full lg:w-48 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Title</label>
                <input
                  value={v.title}
                  onChange={(e) => update(i, "title", e.target.value)}
                  className={inputCls}
                />
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
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition mb-0.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Chapter editor */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>
                Chapters{" "}
                <span className="text-muted-foreground font-normal">
                  (optional — mark key moments)
                </span>
              </label>
              <button
                onClick={() => addChapter(i)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary hover:bg-primary/15 transition font-semibold"
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
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Score Logs Importer */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 -mx-5 -mb-5 p-5 rounded-b-2xl">
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
               }} className="text-xs font-bold px-4 py-2 rounded-xl bg-primary/15 text-primary dark:bg-primary/40 dark:text-primary hover:bg-primary/20 dark:hover:bg-primary/80/60 transition shadow-sm">
                 Paste from Clipboard
               </button>
               {v.scoreLogs && v.scoreLogs.length > 0 && (
                 <button onClick={() => update(i, "scoreLogs", undefined as any)} className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 transition">
                   Clear
                 </button>
               )}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-primary hover:text-primary transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Video
      </button>
    </div>
  );
}


