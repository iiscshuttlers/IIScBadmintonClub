import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2, Plus, Loader2, UserCheck, UserX, Activity, Search, RefreshCw, Download, AlertTriangle, Play, Pencil, Clock, CheckCircle2, Ban, Shield, History, FileDown, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAdminHistory } from "@/contexts/AdminHistoryContext";

/* -- Shared Types -- */
export type Holiday = { date: string; name: string };
export type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  priority?: string;
  location?: string;
  contact?: string;
  content: string;
  url?: string;
  flyer?: DynamicFlyer;
};
export type EventItem = {
  date: string;
  endDate?: string;
  title: string;
  link: string;
  url?: string;
  registrationDeadline?: string;
  time?: string;
  location?: string;
};
export type Chapter = { time: number; title: string };
export type VideoItem = {
  id: string;
  title: string;
  videoId: string;
  category: string;
  tournament?: string;
  chapters?: Chapter[];
  scoreLogs?: any[];
};
export type Player = {
  id: string;
  full_name: string;
  email?: string;
  department?: string;
  is_approved: boolean;
  created_at: string;
  stats?: any;
  iisc_email?: string;
  contact_number?: string;
  sr_number?: string;
  role?: string;
  is_retired?: boolean;
  gender?: string;
};
export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  email_confirmed_at?: string;
};
export type SiteConfig = {
  stats: {
    members: string;
    tournaments: string;
    courts: string;
    trophies: string;
  };
  about: { history: string; mission: string };
  elo?: {
    kNewbie: number;
    kExperienced: number;
    tournamentMultiplier: number;
  };
};
export type FlyerItem = { text: string; colorClass: string; };
export type DynamicFlyer = {
  id: string;
  enabled: boolean;
  bgColorClass: string;
  items: FlyerItem[];
  startDate?: string;
  endDate?: string;
  speed?: "slow" | "normal" | "fast" | "custom";
  customSpeed?: number;
  url?: string;
};

export const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground dark:text-foreground text-sm outline-none focus:ring-2 focus:ring-primary transition";
export const labelCls =
  "block text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-1.5";
export const cardCls =
  "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";
export const colorSwatchCls =
  "h-10 w-12 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer p-0.5";

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export const toHex = (val: string, fallback: string) =>
  val && HEX_RE.test(val.trim()) ? val.trim() : fallback;

export function parseTime(val: string): number {
  const trimmed = val.trim();
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return Math.max(0, parseInt(trimmed, 10) || 0);
}

export function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
