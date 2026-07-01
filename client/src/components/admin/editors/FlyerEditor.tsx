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

export function FlyerEditor({
  data,
  onChange,
}: {
  data: DynamicFlyer[];
  onChange: (d: DynamicFlyer[]) => void;
}) {
  const add = () => onChange([...data, { id: `flyer_${Date.now()}`, enabled: true, bgColorClass: "bg-gradient-to-r from-violet-600 to-fuchsia-600", items: [{ text: "New Announcement", colorClass: "text-foreground" }] }]);
  const remove = (i: number) => onChange(data.filter((_, idx) => idx !== i));
  const updateFlyer = (i: number, next: DynamicFlyer) => {
    const nextData = [...data];
    nextData[i] = next;
    onChange(nextData);
  };

  return (
    <div className="space-y-4">
      {data.map((f, i) => (
        <div key={f.id} className={`${cardCls} flex flex-col gap-3`}>
          <FlyerConfigBuilder f={f} onChange={(next) => updateFlyer(i, next)} onRemove={() => remove(i)} />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-muted-foreground hover:border-primary hover:text-primary transition text-sm font-bold w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Flyer
      </button>
    </div>
  );
}


/*  Announcement Editor                                              */
