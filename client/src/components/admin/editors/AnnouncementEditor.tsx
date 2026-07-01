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
import { FlyerConfigBuilder } from './FlyerConfigBuilder';
import { FileUploader } from './FileUploader';

export function AnnouncementEditor({
  data,
  onChange,
}: {
  data: Announcement[];
  onChange: (d: Announcement[]) => void;
}) {
  const [pushingIdx, setPushingIdx] = useState<number | null>(null);

  const sendPush = async (a: Announcement) => {
    if (!a.title || !a.content) { toast.error("Title and content required before sending push."); return; }
    const idx = data.indexOf(a);
    setPushingIdx(idx);
    try {
      const { error } = await supabase.functions.invoke("send-announcement", {
        body: { title: a.title, body: a.content.slice(0, 120) },
      });
      if (error) throw error;
      toast.success(`Push sent for "${a.title}"!`);
    } catch (err: any) {
      toast.error("Push failed: " + (err.message ?? String(err)));
    } finally {
      setPushingIdx(null);
    }
  };

  const add = () =>
    onChange([
      {
        title: "",
        date: new Date().toISOString().slice(0, 10),
        category: "general",
        priority: "medium",
        content: "",
      },
      ...data,
    ]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: any) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const categories = ["tournament", "facility", "general", "event"];
  return (
    <div className="space-y-4">
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary text-foreground text-sm font-bold transition shadow-md shadow-primary/20"
      >
        <Plus className="w-4 h-4" /> New Announcement
      </button>
      {data.map((a, i) => (
        <div key={i} className={`${cardCls} space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">
              #{i + 1}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendPush(a)}
                disabled={pushingIdx === i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-50"
              >
                {pushingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Send Push
              </button>
              <button
                onClick={() => remove(i)}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title</label>
              <input
                value={a.title}
                onChange={(e) => update(i, "title", e.target.value)}
                className={inputCls}
                placeholder="Announcement title"
              />
            </div>
            <div>
              <label className={labelCls}>Publish Date</label>
              <input
                type="date"
                value={a.date || ""}
                onChange={(e) => update(i, "date", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={a.category}
                onChange={(e) => update(i, "category", e.target.value)}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={a.priority || "medium"}
                onChange={(e) => update(i, "priority", e.target.value)}
                className={inputCls}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                value={a.location || ""}
                onChange={(e) => update(i, "location", e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelCls}>Event Start Date</label>
              <input
                type="date"
                value={a.startDate || ""}
                onChange={(e) => update(i, "startDate", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Event End Date</label>
              <input
                type="date"
                value={a.endDate || ""}
                onChange={(e) => update(i, "endDate", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>URL (Optional)</label>
              <input
                value={a.url || ""}
                onChange={(e) => update(i, "url", e.target.value)}
                className={inputCls}
                placeholder="https://..."
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                Content
              </label>
              <FileUploader
                onUpload={(url) =>
                  update(
                    i,
                    "content",
                    a.content + `\n\n[Download Attachment](${url})`,
                  )
                }
              />
            </div>
            <textarea
              rows={4}
              value={a.content}
              onChange={(e) => update(i, "content", e.target.value)}
              className={`${inputCls} resize-y`}
              placeholder="Write normally! New lines are automatic. You can use markdown: **bold**, *italic*, [Link Text](https://link.com)"
            />
          </div>
          
          {/* Custom Flyer Config */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-muted-foreground dark:text-slate-300 mb-4 w-max">
              <input
                type="checkbox"
                checked={!!a.flyer?.enabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    update(i, "flyer", {
                      ...(a.flyer || {
                        id: `ann_flyer_${Date.now()}`,
                        bgColorClass: "bg-gradient-to-r from-primary to-teal-600",
                        items: [{ text: a.title || "New Event", colorClass: "text-foreground" }]
                      }),
                      enabled: true
                    });
                  } else {
                    update(i, "flyer", { ...a.flyer, enabled: false });
                  }
                }}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              Show as Custom Flyer Banner
            </label>
            
            {a.flyer && a.flyer.enabled && (
              <div className="pl-6 border-l-2 border-primary">
                <FlyerConfigBuilder
                  f={a.flyer}
                  onChange={(next) => update(i, "flyer", next)}
                />
              </div>
            )}
          </div>
          
        </div>
      ))}
    </div>
  );
}


/*  Event Editor                                                     */
