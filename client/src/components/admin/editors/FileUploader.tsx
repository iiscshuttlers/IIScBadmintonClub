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

export function FileUploader({
  onUpload,
}: {
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { error } = await supabase.storage
        .from("tournament_notices")
        .upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("tournament_notices")
        .getPublicUrl(fileName);
      onUpload(data.publicUrl);
      toast.success("File uploaded successfully");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="relative inline-block">
      <input
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        title="Upload File"
      />
      <button
        type="button"
        disabled={uploading}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold transition"
      >
        {uploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        )}
        {uploading ? "Uploading..." : "Upload File"}
      </button>
    </div>
  );
}


/*  Config Editor (Landing Pages & Stats)                            */
