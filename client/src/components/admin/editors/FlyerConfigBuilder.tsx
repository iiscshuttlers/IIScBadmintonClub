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

export function FlyerConfigBuilder({
  f,
  onChange,
  onRemove,
}: {
  f: DynamicFlyer;
  onChange: (next: DynamicFlyer) => void;
  onRemove?: () => void;
}) {
  const update = (field: keyof DynamicFlyer, val: any) => onChange({ ...f, [field]: val });
  const addItem = () => onChange({ ...f, items: [...f.items, { text: "New Item", colorClass: "text-foreground" }] });
  const removeItem = (itemIdx: number) => onChange({ ...f, items: f.items.filter((_, idx) => idx !== itemIdx) });
  const updateItem = (itemIdx: number, field: keyof FlyerItem, val: string) => {
    const nextItems = [...f.items];
    nextItems[itemIdx] = { ...nextItems[itemIdx], [field]: val };
    onChange({ ...f, items: nextItems });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        {/* Row 1: Color & Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end w-full">
          <div className="flex-[2] w-full sm:w-auto">
            <label className={labelCls}>Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHex(f.bgColorClass, "#7c3aed")}
                onChange={(e) => update("bgColorClass", e.target.value)}
                className={colorSwatchCls}
                title="Pick background color"
              />
              <input
                value={f.bgColorClass}
                onChange={(e) => update("bgColorClass", e.target.value)}
                className={inputCls}
                placeholder="#7c3aed or a Tailwind gradient class"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 mb-2.5">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-muted-foreground dark:text-slate-300">
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={(e) => update("enabled", e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              Enabled
            </label>
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                title="Delete Flyer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Dates & Speed */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end w-full">
          <div className="flex-1 w-full sm:w-auto">
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={f.startDate || ""}
              onChange={(e) => update("startDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              value={f.endDate || ""}
              onChange={(e) => update("endDate", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className={labelCls}>Speed</label>
            <div className="flex items-center gap-2">
              <select
                value={f.speed || "normal"}
                onChange={(e) => update("speed", e.target.value)}
                className={inputCls}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
                <option value="custom">Custom</option>
              </select>
              {f.speed === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="600"
                    value={f.customSpeed || 90}
                    onChange={(e) => update("customSpeed", parseInt(e.target.value, 10))}
                    className={`${inputCls} w-20 px-2`}
                    placeholder="90"
                  />
                  <span className="text-xs font-bold text-muted-foreground">secs</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className={labelCls}>Link URL (Optional)</label>
            <input
              value={f.url || ""}
              onChange={(e) => update("url", e.target.value)}
              className={inputCls}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className={labelCls}>Flyer Items</label>
        {f.items.map((item, itemIdx) => (
          <div key={itemIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl">
            <input
              value={item.text}
              onChange={(e) => updateItem(itemIdx, "text", e.target.value)}
              className={`${inputCls} flex-[2]`}
              placeholder="Text to display..."
            />
            <div className="flex items-center gap-2 flex-1 w-full">
              <input
                type="color"
                value={toHex(item.colorClass, "#ffffff")}
                onChange={(e) => updateItem(itemIdx, "colorClass", e.target.value)}
                className={colorSwatchCls}
                title="Pick text color"
              />
              <input
                value={item.colorClass}
                onChange={(e) => updateItem(itemIdx, "colorClass", e.target.value)}
                className={inputCls}
                placeholder="#ffffff or e.g. text-yellow-300"
              />
            </div>
            <button
              onClick={() => removeItem(itemIdx)}
              className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary dark:text-primary hover:bg-primary/10 dark:hover:bg-primary/90/30 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Item
        </button>
      </div>
    </div>
  );
}


/*  Flyer Editor                                                     */
