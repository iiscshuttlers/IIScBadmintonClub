import { useEffect, useState, useCallback, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Megaphone,
  Ghost,
  Video,
  CalendarDays,
  Plus,
  Trash2,
  Save,
  Shield,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  Lock,
  LogOut,
  Trophy,
  Minus,
  PlusCircle,
  ChevronDown,
  Search,
  UserCheck,
  UserX,
  FileCode2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { advanceWinners } from "@/lib/tournamentProgression";
import {
  HolidayEditor,
  AnnouncementEditor,
  PollEditor,
  EventEditor,
  VideoEditor,
  PlayersManager,
  UmpireMode,
  ConfigEditor,
  RegistrationsManager,
  MatchesManager,
  ChangelogViewer,
  FlyerEditor,
  type DynamicFlyer,
  type SiteConfig,
} from "@/components/admin/AdminEditors";
import { AdminStatsOverview } from "@/components/admin/AdminStatsOverview";
import { DisputePanel } from "@/components/admin/DisputePanel";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminActivityLog } from "@/components/admin/AdminActivityLog";
import { EloAuditPanel } from "@/components/admin/EloAuditPanel";
import { AdminFeaturesPanel } from "@/components/admin/AdminFeaturesPanel";
import { AdminAllFeaturesPanel } from "@/components/admin/AdminAllFeaturesPanel";
import { TournamentEditor } from "@/components/admin/TournamentEditor";
import { RecycleBin } from "@/components/admin/RecycleBin";
import { GuestPlayersPanel } from "@/components/admin/GuestPlayersPanel";
import { AdminHistoryProvider, useAdminHistory } from "@/contexts/AdminHistoryContext";
import { Paintbrush, ClipboardList, Settings, BarChart2, Zap, Sparkles, ChevronUp, Undo2, Redo2 } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────── */
type Holiday = { date: string; name: string };
type Announcement = {
  title: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  category: string;
  priority?: string;
  location?: string;
  contact?: string;
  content: string;
};
type EventItem = {
  date: string;
  title: string;
  link: string;
  registrationDeadline?: string;
};
type VideoItem = {
  id: string;
  title: string;
  videoId: string;
  category: string;
  tournament?: string;
};
type Player = {
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
};

type TabId =
  | "overview"
  | "config"
  | "flyers"
  | "holidays"
  | "announcements"
  | "polls"
  | "events"
  | "tournament"
  | "videos"
  | "players"
  | "guests"
  | "umpire"
  | "registrations"
  | "matches"
  | "changelog"
  | "disputes"
  | "elo_audit"
  | "settings"
  | "activity_log"
  | "features"
  | "all_features"
  | "recycle_bin";

interface TabGroup {
  title: string;
  description: string;
  tabs: { id: TabId; label: string; icon: any }[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    title: "📊 Dashboard",
    description: "Platform statistics and overview",
    tabs: [
      { id: "overview", label: "Statistics", icon: Activity },
    ],
  },
  {
    title: "📝 Content Management",
    description: "Manage club content, announcements, and events",
    tabs: [
      { id: "config", label: "Landing Pages", icon: Paintbrush },
      { id: "flyers", label: "Flyers", icon: Megaphone },
      { id: "announcements", label: "Announcements", icon: Megaphone },
      { id: "polls", label: "Community Polls", icon: Megaphone },
      { id: "holidays", label: "Holidays", icon: Calendar },
      { id: "events", label: "Events", icon: CalendarDays },
      { id: "tournament", label: "Tournament", icon: Trophy },
      { id: "videos", label: "Videos", icon: Video },
    ],
  },
  {
    title: "🎮 Match Management",
    description: "Manage players, matches, umpiring, and disputes",
    tabs: [
      { id: "players", label: "Players", icon: Users },
      { id: "guests", label: "Guests", icon: Ghost },
      { id: "matches", label: "Matches", icon: Trophy },
      { id: "umpire", label: "Umpire Mode", icon: Activity },
      { id: "disputes", label: "Disputes", icon: AlertTriangle },
      { id: "elo_audit", label: "ELO Audit", icon: BarChart2 },
    ],
  },
  {
    title: "✨ Features & Info",
    description: "View platform features and system information",
    tabs: [
      { id: "all_features", label: "All Features", icon: Sparkles },
      { id: "features", label: "Live Features", icon: Zap },
    ],
  },
  {
    title: "⚙️ System",
    description: "System configuration, logs, and settings",
    tabs: [
      { id: "settings", label: "Settings", icon: Settings },
      { id: "activity_log", label: "Activity Log", icon: ClipboardList },
      { id: "changelog", label: "System Logs", icon: FileCode2 },
      { id: "recycle_bin", label: "Recycle Bin", icon: Trash2 },
    ],
  },
];

// Flatten for easier access
const TABS: { id: TabId; label: string; icon: any }[] = TAB_GROUPS.flatMap(
  (group) => group.tabs
);

/* ── Helpers ─────────────────────────────────────────────────────── */
async function loadKey<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("site_data")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error(`Load ${key}:`, error);
    return null;
  }
  return (data?.value as T) ?? null;
}

async function saveKey(key: string, value: any) {
  const { error } = await supabase
    .from("site_data")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition";
const labelCls =
  "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls =
  "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm";

/* ================================================================ */
/*  Main Admin Page                                                  */
/* ================================================================ */
export default function SiteAdmin() {
  return (
    <AdminHistoryProvider>
      <SiteAdminInner />
    </AdminHistoryProvider>
  );
}

function SiteAdminInner() {
  usePageMeta({
    title: "Admin",
    description: "Manage site content, players, and live tournaments",
  });
  const [, setLocation] = useLocation();

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">(
    "loading",
  );
  const { session, isInitializing, isAdmin, isMainAdmin, isMasterAdmin, isUmpire } = useAuth();
  const { canUndo, canRedo, undo, redo, recordAction, recycleBinCount, reloadTrigger } = useAdminHistory();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace("#", "");
    if ([
      "overview", "config", "flyers", "holidays", "announcements", "polls", "events", "videos",
      "players", "umpire", "registrations", "matches", "changelog",
      "disputes", "elo_audit", "settings", "activity_log", "features", "recycle_bin"
    ].includes(hash)) {
      return hash as TabId;
    }
    return isAdmin ? "overview" : "umpire";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if ([
        "overview", "config", "flyers", "holidays", "announcements", "polls", "events", "videos",
        "players", "umpire", "registrations", "matches", "changelog",
        "disputes", "elo_audit", "settings", "activity_log", "features", "all_features", "recycle_bin"
      ].includes(hash)) {
        setActiveTab(hash as TabId);
      }
    };
    window.addEventListener("hashchange", handleHashChange);

    // Ensure initial hash is set without pushing to history if none exists
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#${activeTab}`);
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId; // This pushes history state natively
  };
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const originals = useRef({
    flyers: [] as DynamicFlyer[],
    holidays: [] as Holiday[],
    announcements: [] as Announcement[],
      polls: [] as any[],
    events: [] as EventItem[],
    videos: [] as VideoItem[],
    config: null as SiteConfig | null,
  });

  const [flyers, setFlyersRaw] = useState<DynamicFlyer[]>([]);
  const [holidays, setHolidaysRaw] = useState<Holiday[]>([]);
  const [announcements, setAnnouncementsRaw] = useState<Announcement[]>([]);
  const [polls, setPollsRaw] = useState<any[]>([]);
  const [events, setEventsRaw] = useState<EventItem[]>([]);
  const [videos, setVideosRaw] = useState<VideoItem[]>([]);
  const [config, setConfigRaw] = useState<SiteConfig | null>(null);

  // Navigation UI state - MUST be before any early returns (Rules of Hooks)
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  useClickOutside(navRef, () => setNavOpen(false), navOpen);

  // Auth gate
  useEffect(() => {
    if (isInitializing) {
      setAuthState("loading");
    } else if (session) {
      // Real master admin always gets in; effective role controls what tabs are visible
      if (isMasterAdmin) {
        setAuthState("ok");
      } else if (activeTab === "umpire") {
        setAuthState(isUmpire ? "ok" : "denied");
      } else {
        setAuthState(isAdmin ? "ok" : "denied");
      }
    } else {
      setAuthState("denied");
    }
  }, [session, isInitializing, isAdmin, isMasterAdmin, isUmpire, activeTab]);

  // Load content data
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, h, a, e, v, c, p] = await Promise.all([
        loadKey<DynamicFlyer[]>("flyers"),
        loadKey<Holiday[]>("holidays"),
        loadKey<{ recent: Announcement[] }>("announcements"),
        loadKey<EventItem[]>("events"),
        loadKey<VideoItem[]>("videos"),
        loadKey<SiteConfig>("site_config"),
        loadKey<{ polls: any[] }>("polls"),
      ]);

        if (p?.polls) {
          setPollsRaw(p.polls);
          originals.current.polls = JSON.parse(JSON.stringify(p.polls));
        }
      if (f) {
        setFlyersRaw(f);
        originals.current.flyers = JSON.parse(JSON.stringify(f));
      }
      if (h) {
        setHolidaysRaw(h);
        originals.current.holidays = JSON.parse(JSON.stringify(h));
      }
      if (a?.recent) {
        setAnnouncementsRaw(a.recent);
        originals.current.announcements = JSON.parse(JSON.stringify(a.recent));
      }
      if (e) {
        setEventsRaw(e);
        originals.current.events = JSON.parse(JSON.stringify(e));
      }
      if (v) {
        setVideosRaw(v);
        originals.current.videos = JSON.parse(JSON.stringify(v));
      }
      if (c) {
        setConfigRaw(c);
        originals.current.config = JSON.parse(JSON.stringify(c));
      }
      setDirty(false);
    } catch (err) {
      toast("Failed to load data", { icon: "❌" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "ok") loadAll();
  }, [authState, loadAll]);

  // Reload content tabs after an undo/redo that touched site_data
  useEffect(() => {
    if (reloadTrigger > 0 && authState === "ok") loadAll();
  }, [reloadTrigger, authState, loadAll]);

  // Dirty wrappers
  const setF = (d: DynamicFlyer[]) => {
    setFlyersRaw(d);
    setDirty(true);
  };
  const setH = (d: Holiday[]) => {
    setHolidaysRaw(d);
    setDirty(true);
  };
  const setA = (d: Announcement[]) => {
    setAnnouncementsRaw(d);
    setDirty(true);
  };
  const setP = (d: any[]) => {
    setPollsRaw(d);
    setDirty(true);
  };
  const setE = (d: EventItem[]) => {
    setEventsRaw(d);
    setDirty(true);
  };
  const setV = (d: VideoItem[]) => {
    setVideosRaw(d);
    setDirty(true);
  };
  const setC = (d: SiteConfig) => {
    setConfigRaw(d);
    setDirty(true);
  };

  const handleUndo = () => {
    switch (activeTab) {
      case "config":
        setConfigRaw(JSON.parse(JSON.stringify(originals.current.config)));
        break;
      case "flyers":
        setFlyersRaw(JSON.parse(JSON.stringify(originals.current.flyers)));
        break;
      case "holidays":
        setHolidaysRaw(JSON.parse(JSON.stringify(originals.current.holidays)));
        break;
      case "announcements":
        setAnnouncementsRaw(
          JSON.parse(JSON.stringify(originals.current.announcements)),
        );
        break;
      case "polls":
        setPollsRaw(JSON.parse(JSON.stringify(originals.current.polls)));
        break;
      case "events":
        setEventsRaw(JSON.parse(JSON.stringify(originals.current.events)));
        break;
      case "videos":
        setVideosRaw(JSON.parse(JSON.stringify(originals.current.videos)));
        break;
    }
    setDirty(false);
    toast("Changes discarded", { icon: "↩️" });
  };

  const getDiffView = () => {
    let oldObj, newObj;
    switch (activeTab) {
      case "config":
        oldObj = originals.current.config;
        newObj = config;
        break;
      case "flyers":
        oldObj = originals.current.flyers;
        newObj = flyers;
        break;
      case "holidays":
        oldObj = originals.current.holidays;
        newObj = holidays;
        break;
      case "announcements":
        oldObj = originals.current.announcements;
        newObj = announcements;
        break;
      case "polls":
        oldObj = originals.current.polls;
        newObj = polls;
        break;
      case "events":
        oldObj = originals.current.events;
        newObj = events;
        break;
      case "videos":
        oldObj = originals.current.videos;
        newObj = videos;
        break;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-mono">
        <div className="flex flex-col">
          <div className="bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 font-bold px-3 py-2 rounded-t-lg border-b border-rose-200 dark:border-rose-800/50">
            Current Live Version
          </div>
          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-b-lg text-slate-700 dark:text-slate-300 whitespace-pre overflow-x-auto border border-rose-100 dark:border-rose-900/30 border-t-0 h-[400px] overflow-y-auto shadow-inner">
            {JSON.stringify(oldObj, null, 2)}
          </div>
        </div>
        <div className="flex flex-col">
          <div className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-3 py-2 rounded-t-lg border-b border-emerald-200 dark:border-emerald-800/50">
            Your New Changes
          </div>
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-b-lg text-slate-700 dark:text-slate-300 whitespace-pre overflow-x-auto border border-emerald-100 dark:border-emerald-900/30 border-t-0 h-[400px] overflow-y-auto shadow-inner">
            {JSON.stringify(newObj, null, 2)}
          </div>
        </div>
      </div>
    );
  };

  const handleSave = () => setShowConfirm(true);

  const confirmSave = async () => {
    setSaving(true);
    try {
      // Determine key + before/after for history recording
      let historyKey: string | null = null;
      let beforeState: any = null;
      let afterState: any = null;

      switch (activeTab) {
        case "config":
          if (config) {
            historyKey = "site_config";
            beforeState = originals.current.config;
            afterState = config;
            await saveKey("site_config", config);
            originals.current.config = JSON.parse(JSON.stringify(config));
          }
          break;
        case "flyers":
          historyKey = "flyers";
          beforeState = originals.current.flyers;
          afterState = flyers;
          await saveKey("flyers", flyers);
          originals.current.flyers = JSON.parse(JSON.stringify(flyers));
          break;
        case "holidays":
          historyKey = "holidays";
          beforeState = originals.current.holidays;
          afterState = holidays.filter((h) => h.date && h.name);
          await saveKey("holidays", afterState);
          originals.current.holidays = JSON.parse(JSON.stringify(holidays));
          break;
        case "announcements":
          historyKey = "announcements";
          beforeState = originals.current.announcements;
          afterState = { recent: announcements.filter((a) => a.title) };
          await saveKey("announcements", afterState);
          originals.current.announcements = JSON.parse(
            JSON.stringify(announcements),
          );
          break;
        case "polls":
          historyKey = "polls";
          beforeState = originals.current.polls;
          afterState = { polls };
          await saveKey("polls", afterState);
          originals.current.polls = JSON.parse(JSON.stringify(polls));
          break;
        case "events":
          historyKey = "events";
          beforeState = originals.current.events;
          afterState = events.filter((e) => e.title && e.date);
          await saveKey("events", afterState);
          originals.current.events = JSON.parse(JSON.stringify(events));
          break;
        case "videos":
          historyKey = "videos";
          beforeState = originals.current.videos;
          afterState = videos.filter((v) => v.title && v.videoId);
          await saveKey("videos", afterState);
          originals.current.videos = JSON.parse(JSON.stringify(videos));
          break;
      }

      // Record in admin history for undo support
      if (historyKey) {
        await recordAction({
          action_type: "update",
          entity_type: "site_data",
          entity_id: historyKey,
          before_state: beforeState,
          after_state: afterState,
          label: `Updated ${activeTab}`,
        });
      }

      setDirty(false);
      setShowConfirm(false);
      toast("Saved!", {
        icon: "✅",
        description: `${activeTab} updated — live instantly.`,
      });
    } catch (err: any) {
      toast("Save failed", { icon: "❌", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // Auth screens
  if (authState === "loading")
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );

  if (authState === "denied")
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xl max-w-md">
          <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Admin Access Required
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {session ? "Your account does not have admin privileges." : "You need to be signed in with an admin account."}
          </p>
          {!session ? (
            <button
              onClick={() => {
                sessionStorage.setItem("return_url", window.location.pathname + window.location.search + window.location.hash);
                setLocation("/join");
              }}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => setLocation("/")}
              className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition shadow-lg shadow-slate-500/20"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );

  const contentTabs: TabId[] = [
    "config",
    "flyers",
    "holidays",
    "announcements",
    "polls",
    "events",
    "videos",
  ];
  const counts: Record<Exclude<TabId, "registrations">, number | null> = {
    overview: null,
    config: null,
    flyers: flyers.length,
    holidays: holidays.length,
    announcements: announcements.length,
      polls: polls.length,
    events: events.length,
    tournament: null,
    videos: videos.length,
    players: null,
    guests: null,
    matches: null,
    umpire: null,
    changelog: null,
    disputes: null,
    elo_audit: null,
    settings: null,
    activity_log: null,
    features: null,
    all_features: null,
    recycle_bin: recycleBinCount > 0 ? recycleBinCount : null,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-safe pb-24 lg:pb-8">
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">
                <Shield className="w-4 h-4" /> Admin Panel
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Control Center
              </h1>
              <p className="text-slate-300 text-sm mt-1">
                Site content · Player management · Live tournament scoring
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Undo last saved action (Ctrl+Z)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Redo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Redo</span>
              </button>
              {contentTabs.includes(activeTab) && (
                <button
                  onClick={loadAll}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />{" "}
                  Reload
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Tab Groups Navigation */}
        {(() => {
          const activeGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab));
          const activeTabMeta = TABS.find(t => t.id === activeTab);
          const ActiveIcon = activeTabMeta?.icon;

          const navGrid = (
            <div className="space-y-4">
              {TAB_GROUPS.map((group) => {
                const visibleTabs = group.tabs.filter((tab) => isAdmin || tab.id === "umpire");
                if (visibleTabs.length === 0) return null;
                return (
                  <div key={group.title} className="space-y-2">
                    <div className="flex items-start gap-3 px-4 py-2">
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-white text-sm">{group.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{group.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 px-2">
                      {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        const count = counts[tab.id];
                        return (
                          <button
                            key={tab.id}
                            onClick={() => { handleTabChange(tab.id); setNavOpen(false); }}
                            className={`group flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all duration-300 relative ${
                              active
                                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-300 dark:border-emerald-700/60 shadow-sm"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:text-emerald-600 dark:hover:text-emerald-400"
                            }`}
                          >
                            {Icon && (
                              <Icon className={`w-5 h-5 transition-colors ${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"}`} />
                            )}
                            <span className="text-center leading-tight">{tab.label}</span>
                            {count !== null && (
                              <span className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded-full font-black ${active ? "bg-emerald-600 text-white" : "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );

          return (
            <div className="mb-8">
              {/* Mobile: compact collapsed bar */}
              <div className="lg:hidden" ref={navRef}>
                <button
                  onClick={() => setNavOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 mb-3"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {ActiveIcon && <ActiveIcon className="w-4 h-4 text-emerald-500 shrink-0" />}
                    <span className="truncate">{activeGroup?.title ?? "Navigation"} › {activeTabMeta?.label}</span>
                  </span>
                  <ChevronUp className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${navOpen ? "" : "rotate-180"}`} />
                </button>
                {navOpen && navGrid}
              </div>
              {/* Desktop: always visible */}
              <div className="hidden lg:block">{navGrid}</div>
            </div>
          );
        })()}

        {/* Editor */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "overview" && isAdmin && <AdminStatsOverview />}
            {activeTab === "config" && (
              <ConfigEditor data={config} onChange={setC} />
            )}
            {activeTab === "flyers" && (
              <FlyerEditor data={flyers} onChange={setF} />
            )}
            {activeTab === "holidays" && (
              <HolidayEditor data={holidays} onChange={setH} />
            )}
            {activeTab === "announcements" && (
              <AnnouncementEditor data={announcements} onChange={setA} />
            )}
            {activeTab === "polls" && (
              <PollEditor data={polls} onChange={setP} />
            )}
            {activeTab === "events" && (
              <EventEditor data={events} onChange={setE} />
            )}
            {activeTab === "tournament" && <TournamentEditor />}
            {activeTab === "videos" && (
              <VideoEditor data={videos} onChange={setV} />
            )}
            {activeTab === "players" && <PlayersManager />}
            {activeTab === "guests" && <GuestPlayersPanel />}
            {activeTab === "matches" && <MatchesManager />}
            {activeTab === "disputes" && <DisputePanel />}
            {activeTab === "elo_audit" && <EloAuditPanel />}
            {activeTab === "umpire" && <UmpireMode />}
            {activeTab === "changelog" && <ChangelogViewer />}
            {activeTab === "activity_log" && <AdminActivityLog />}
            {activeTab === "settings" && <AdminSettings />}
            {activeTab === "features" && <AdminFeaturesPanel />}
            {activeTab === "all_features" && <AdminAllFeaturesPanel />}
            {activeTab === "recycle_bin" && <RecycleBin />}
          </motion.div>
        </AnimatePresence>

        {/* Unsaved changes bar (only for content tabs) */}
        <AnimatePresence>
          {dirty && contentTabs.includes(activeTab) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="sticky bottom-[88px] lg:bottom-6 mt-8 mx-auto w-[90%] sm:w-max z-[9998] flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 sm:gap-4 px-4 sm:px-6 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl border border-slate-700 dark:border-slate-300"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 dark:text-amber-600 shrink-0" />
                <span className="text-sm font-bold whitespace-nowrap">Unsaved changes</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                <button
                  onClick={handleUndo}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white dark:text-slate-500 dark:hover:text-slate-900 text-sm font-bold transition disabled:opacity-50"
                >
                  Undo
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-50 shadow-md w-full sm:w-auto min-w-[140px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Save className="w-4 h-4 shrink-0" />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Save Modal */}
        <AnimatePresence>
          {showConfirm && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowConfirm(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 shrink-0">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 capitalize">
                    <Save className="w-5 h-5 text-emerald-500" /> Review
                    Changes: {activeTab}
                  </h2>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto flex-1 min-h-0">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Please double check your changes before confirming. The left
                    side is what is currently live, and the right side is what
                    will be saved.
                  </p>
                  {getDiffView()}
                </div>
                <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  >
                    Keep Editing
                  </button>
                  <button
                    onClick={confirmSave}
                    disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    ) : (
                      <Save className="w-5 h-5 shrink-0" />
                    )}
                    {saving ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
