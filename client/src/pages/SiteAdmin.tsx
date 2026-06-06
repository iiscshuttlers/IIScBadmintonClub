import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Megaphone, Video, CalendarDays, Plus, Trash2, Save,
  Shield, RefreshCw, AlertTriangle, Loader2, Users, Activity,
  CheckCircle, XCircle, Lock, LogOut, Trophy, Minus, PlusCircle,
  ChevronDown, Search, UserCheck, UserX
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import {
  signInAnonymously, onAuthStateChanged, signOut, User as FirebaseUser,
} from "firebase/auth";
import { advanceWinners } from "@/lib/tournamentProgression";
import { HolidayEditor, AnnouncementEditor, EventEditor, VideoEditor, PlayersManager, UmpireMode } from "@/components/admin/AdminEditors";

/* ── Types ──────────────────────────────────────────────────────── */
type Holiday = { date: string; name: string };
type Announcement = {
  title: string; date?: string; startDate?: string; endDate?: string;
  category: string; priority?: string; location?: string; contact?: string; content: string;
};
type EventItem = { date: string; title: string; link: string; registrationDeadline?: string };
type VideoItem = { id: string; title: string; videoId: string; category: string };
type Player = {
  id: string; full_name: string; email?: string; department?: string;
  is_approved: boolean; created_at: string; stats?: any; iisc_email?: string;
  contact_number?: string; sr_number?: string;
};

type TabId = "holidays" | "announcements" | "events" | "videos" | "players" | "umpire";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "holidays",      label: "Holidays",      icon: Calendar },
  { id: "announcements", label: "Announcements",  icon: Megaphone },
  { id: "events",        label: "Events",         icon: CalendarDays },
  { id: "videos",        label: "Videos",         icon: Video },
  { id: "players",       label: "Players",        icon: Users },
  { id: "umpire",        label: "Umpire",         icon: Activity },
];

/* ── Helpers ─────────────────────────────────────────────────────── */
async function loadKey<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("site_data").select("value").eq("key", key).maybeSingle();
  if (error) { console.error(`Load ${key}:`, error); return null; }
  return data?.value as T ?? null;
}

async function saveKey(key: string, value: any) {
  const { error } = await supabase
    .from("site_data").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls  = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

/* ================================================================ */
/*  Main Admin Page                                                  */
/* ================================================================ */
export default function SiteAdmin() {
  usePageMeta({ title: "Admin", description: "Manage site content, players, and live tournaments" });
  const [, setLocation] = useLocation();

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [activeTab, setActiveTab] = useState<TabId>("holidays");
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [dirty, setDirty]         = useState(false);

  const [holidays,      setHolidaysRaw]      = useState<Holiday[]>([]);
  const [announcements, setAnnouncementsRaw] = useState<Announcement[]>([]);
  const [events,        setEventsRaw]        = useState<EventItem[]>([]);
  const [videos,        setVideosRaw]        = useState<VideoItem[]>([]);

  // Auth gate
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthState("denied"); return; }
      const { data } = await supabase.auth.getUser();
      setAuthState(data?.user && isAdminEmail(data.user.email) ? "ok" : "denied");
    });
  }, []);

  // Load content data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a, e, v] = await Promise.all([
        loadKey<Holiday[]>("holidays"),
        loadKey<{ recent: Announcement[] }>("announcements"),
        loadKey<EventItem[]>("events"),
        loadKey<VideoItem[]>("videos"),
      ]);
      if (h) setHolidaysRaw(h);
      if (a?.recent) setAnnouncementsRaw(a.recent);
      if (e) setEventsRaw(e);
      if (v) setVideosRaw(v);
      setDirty(false);
    } catch (err) {
      toast("Failed to load data", { icon: "❌" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authState === "ok") loadAll(); }, [authState, loadAll]);

  // Dirty wrappers
  const setH = (d: Holiday[])      => { setHolidaysRaw(d);      setDirty(true); };
  const setA = (d: Announcement[]) => { setAnnouncementsRaw(d); setDirty(true); };
  const setE = (d: EventItem[])    => { setEventsRaw(d);        setDirty(true); };
  const setV = (d: VideoItem[])    => { setVideosRaw(d);        setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      switch (activeTab) {
        case "holidays":      await saveKey("holidays", holidays.filter(h => h.date && h.name)); break;
        case "announcements": await saveKey("announcements", { recent: announcements.filter(a => a.title) }); break;
        case "events":        await saveKey("events", events.filter(e => e.title && e.date)); break;
        case "videos":        await saveKey("videos", videos.filter(v => v.title && v.videoId)); break;
      }
      setDirty(false);
      toast("Saved!", { icon: "✅", description: `${activeTab} updated — live instantly.` });
    } catch (err: any) {
      toast("Save failed", { icon: "❌", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // Auth screens
  if (authState === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );

  if (authState === "denied") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xl max-w-md">
        <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Admin Access Required</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">You need to be signed in with an admin account.</p>
        <button onClick={() => setLocation("/join")} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-500/20">
          Sign In
        </button>
      </div>
    </div>
  );

  const contentTabs: TabId[] = ["holidays", "announcements", "events", "videos"];
  const counts: Record<TabId, number | null> = {
    holidays: holidays.length,
    announcements: announcements.length,
    events: events.length,
    videos: videos.length,
    players: null,
    umpire: null,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">
                <Shield className="w-4 h-4" /> Admin Panel
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Control Center</h1>
              <p className="text-slate-300 text-sm mt-1">Site content · Player management · Live tournament scoring</p>
            </div>
            {contentTabs.includes(activeTab) && (
              <button onClick={loadAll} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Reload
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = counts[tab.id];
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-300"
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {count !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
            {activeTab === "holidays"      && <HolidayEditor      data={holidays}      onChange={setH} />}
            {activeTab === "announcements" && <AnnouncementEditor data={announcements} onChange={setA} />}
            {activeTab === "events"        && <EventEditor        data={events}        onChange={setE} />}
            {activeTab === "videos"        && <VideoEditor        data={videos}        onChange={setV} />}
            {activeTab === "players"       && <PlayersManager />}
            {activeTab === "umpire"        && <UmpireMode />}
          </motion.div>
        </AnimatePresence>

        {/* Unsaved changes bar (only for content tabs) */}
        <AnimatePresence>
          {dirty && contentTabs.includes(activeTab) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl border border-slate-700 dark:border-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span className="text-sm font-bold">Unsaved changes</span>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Now"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
