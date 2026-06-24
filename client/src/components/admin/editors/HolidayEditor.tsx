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

export function HolidayEditor({
  data,
  onChange,
}: {
  data: Holiday[];
  onChange: (d: Holiday[]) => void;
}) {
  const add = () => onChange([...data, { date: "", name: "" }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof Holiday, val: string) => {
    const next = [...data];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {data.map((h, i) => (
        <div
          key={i}
          className={`${cardCls} flex flex-col sm:flex-row gap-3 items-start sm:items-end`}
        >
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={h.date}
              onChange={(e) => update(i, "date", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-[2] min-w-0">
            <label className={labelCls}>Holiday Name</label>
            <input
              value={h.name}
              onChange={(e) => update(i, "name", e.target.value)}
              className={inputCls}
              placeholder="e.g. Republic Day"
            />
          </div>
          <button
            onClick={() => remove(i)}
            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Holiday
      </button>
    </div>
  );
}


/*  Flyer Config Builder                                             */
