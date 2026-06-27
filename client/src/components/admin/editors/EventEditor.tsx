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
import { FileUploader } from './FileUploader';

export function EventEditor({
  data,
  onChange,
}: {
  data: EventItem[];
  onChange: (d: EventItem[]) => void;
}) {
  const add = () =>
    onChange([
      ...data,
      { date: "", title: "", link: "", registrationDeadline: "" },
    ]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((e, i) => (
        <div
          key={i}
          className={`${cardCls} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`}
        >
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={e.title}
              onChange={(ev) => update(i, "title", ev.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={e.date}
              onChange={(ev) => update(i, "date", ev.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              value={e.endDate || ""}
              onChange={(ev) => update(i, "endDate", ev.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Link
              </label>
              <FileUploader onUpload={(url) => update(i, "link", url)} />
            </div>
            <input
              value={e.link}
              onChange={(ev) => update(i, "link", ev.target.value)}
              className={inputCls}
              placeholder="/events/..."
            />
          </div>
          <div>
            <label className={labelCls}>Reg. Deadline</label>
            <input
              type="date"
              value={e.registrationDeadline || ""}
              onChange={(ev) => update(i, "registrationDeadline", ev.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <input
              value={e.time || ""}
              onChange={(ev) => update(i, "time", ev.target.value)}
              className={inputCls}
              placeholder="e.g. 2:00 PM – 6:00 PM"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className={labelCls}>Location</label>
              <input
                value={e.location || ""}
                onChange={(ev) => update(i, "location", ev.target.value)}
                className={inputCls}
                placeholder="e.g. Gymnasium Court 1"
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
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Event
      </button>
    </div>
  );
}


/*  Video Editor                                                     */

// Parse "M:SS" or plain seconds string → number of seconds

