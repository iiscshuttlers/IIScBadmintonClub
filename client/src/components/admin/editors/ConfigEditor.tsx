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

export function ConfigEditor({
  data,
  onChange,
}: {
  data: SiteConfig | null;
  onChange: (d: SiteConfig) => void;
}) {
  const d = data || {
    stats: {
      members: "350+",
      tournaments: "20+",
      courts: "3",
      trophies: "10+",
    },
    about: {
      history: "",
      mission:
        "To foster excellence in badminton through competitive play and community engagement at IISc.",
    },
  };

  const updateStats = (field: keyof SiteConfig["stats"], val: string) =>
    onChange({ ...d, stats: { ...d.stats, [field]: val } });
  const updateAbout = (field: keyof SiteConfig["about"], val: string) =>
    onChange({ ...d, about: { ...d.about, [field]: val } });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Global Stats (Home &
          About)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Active Members</label>
            <input
              value={d.stats.members}
              onChange={(e) => updateStats("members", e.target.value)}
              className={inputCls}
              placeholder="e.g. 350+"
            />
          </div>
          <div>
            <label className={labelCls}>Tournaments</label>
            <input
              value={d.stats.tournaments}
              onChange={(e) => updateStats("tournaments", e.target.value)}
              className={inputCls}
              placeholder="e.g. 20+"
            />
          </div>
          <div>
            <label className={labelCls}>Indoor Courts</label>
            <input
              value={d.stats.courts}
              onChange={(e) => updateStats("courts", e.target.value)}
              className={inputCls}
              placeholder="e.g. 3"
            />
          </div>
          <div>
            <label className={labelCls}>IISM Trophies</label>
            <input
              value={d.stats.trophies}
              onChange={(e) => updateStats("trophies", e.target.value)}
              className={inputCls}
              placeholder="e.g. 10+"
            />
          </div>
        </div>
      </div>

      {/* About Page */}
      <div className={cardCls}>
        <h3 className="text-lg font-black text-slate-800 dark:text-foreground mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-500" /> About Page Content
        </h3>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Our Mission</label>
            <textarea
              rows={3}
              value={d.about.mission}
              onChange={(e) => updateAbout("mission", e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </div>
          <div>
            <label className={labelCls}>Our History</label>
            <textarea
              rows={5}
              value={d.about.history}
              onChange={(e) => updateAbout("history", e.target.value)}
              className={`${inputCls} resize-y`}
              placeholder="Write the club's history here. It will appear on the About page."
            />
          </div>
        </div>
      </div>
    </div>
  );
}


/*  Holiday Editor                                                   */
