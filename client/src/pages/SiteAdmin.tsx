import { useEffect, useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Megaphone,
  Ghost,
  Video,
  CalendarDays,
  Trash2,
  Shield,
  AlertTriangle,
  Users,
  Activity,
  Trophy,
  Paintbrush,
  ClipboardList,
  Settings,
  BarChart2,
  Zap,
  Sparkles,
  ChevronUp,
  Undo2,
  Redo2,
  FileCode2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  HolidayEditor,
  AnnouncementEditor,
  PollEditor,
  EventEditor,
  VideoEditor,
  PlayersManager,
  UmpireMode,
  ConfigEditor,
  MatchesManager,
  ChangelogViewer,
  FlyerEditor,
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
import { ContentEditorWrapper } from "@/components/admin/ContentEditorWrapper";

/* ── Types ──────────────────────────────────────────────────────── */
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
    tabs: [{ id: "overview", label: "Statistics", icon: Activity }],
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

const TABS: { id: TabId; label: string; icon: any }[] = TAB_GROUPS.flatMap((group) => group.tabs);

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

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const { session, isInitializing, isAdmin, isMasterAdmin, isUmpire } = useAuth();
  const { canUndo, canRedo, undo, redo, recycleBinCount } = useAdminHistory();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace("#", "");
    if (TABS.some(t => t.id === hash)) return hash as TabId;
    return isAdmin ? "overview" : "umpire";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (TABS.some(t => t.id === hash)) setActiveTab(hash as TabId);
    };
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", `#${activeTab}`);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  useClickOutside(navRef, () => setNavOpen(false), navOpen);

  // Tab counts state for content editors
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isInitializing) setAuthState("loading");
    else if (session) {
      if (isMasterAdmin) setAuthState("ok");
      else if (activeTab === "umpire") setAuthState(isUmpire ? "ok" : "denied");
      else setAuthState(isAdmin ? "ok" : "denied");
    } else setAuthState("denied");
  }, [session, isInitializing, isAdmin, isMasterAdmin, isUmpire, activeTab]);

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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Admin Access Required</h1>
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

  const getTabCount = (tabId: string) => {
    if (tabId === "recycle_bin") return recycleBinCount > 0 ? recycleBinCount : null;
    return tabCounts[tabId] ?? null;
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
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Control Center</h1>
              <p className="text-slate-300 text-sm mt-1">Site content · Player management · Live tournament scoring</p>
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
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Tab Navigation */}
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
                        const count = getTabCount(tab.id);
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
                            {Icon && <Icon className={`w-5 h-5 transition-colors ${active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"}`} />}
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
              <div className="hidden lg:block">{navGrid}</div>
            </div>
          );
        })()}

        {/* Editor Rendering */}
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
              <ContentEditorWrapper dbKey="site_config" emptyState={null} editorName="Landing Page Config" EditorComponent={ConfigEditor} />
            )}
            {activeTab === "flyers" && (
              <ContentEditorWrapper dbKey="flyers" emptyState={[]} editorName="Flyers" EditorComponent={FlyerEditor} setTabCount={(c) => setTabCounts(prev => ({ ...prev, flyers: c }))} />
            )}
            {activeTab === "holidays" && (
              <ContentEditorWrapper 
                dbKey="holidays" 
                emptyState={[]} 
                editorName="Holidays" 
                EditorComponent={HolidayEditor} 
                writeTransformer={(data) => data.filter((h: any) => h.date && h.name)}
                setTabCount={(c) => setTabCounts(prev => ({ ...prev, holidays: c }))} 
              />
            )}
            {activeTab === "announcements" && (
              <ContentEditorWrapper 
                dbKey="announcements" 
                emptyState={{ recent: [] }} 
                editorName="Announcements" 
                // We map {recent: []} to [] for the editor, and back to {recent: []} for the DB
                EditorComponent={(props: any) => <AnnouncementEditor data={props.data.recent || []} onChange={(d) => props.onChange({ recent: d })} />} 
                writeTransformer={(data: any) => ({ recent: data.recent.filter((a: any) => a.title) })}
                setTabCount={(c) => setTabCounts(prev => ({ ...prev, announcements: c }))} 
                countExtractor={(data: any) => data.recent?.length ?? 0}
              />
            )}
            {activeTab === "polls" && (
              <ContentEditorWrapper 
                dbKey="polls" 
                emptyState={{ polls: [] }} 
                editorName="Polls" 
                EditorComponent={(props: any) => <PollEditor data={props.data.polls || []} onChange={(d) => props.onChange({ polls: d })} />} 
                writeTransformer={(data: any) => ({ polls: data.polls })}
                setTabCount={(c) => setTabCounts(prev => ({ ...prev, polls: c }))} 
                countExtractor={(data: any) => data.polls?.length ?? 0}
              />
            )}
            {activeTab === "events" && (
              <ContentEditorWrapper 
                dbKey="events" 
                emptyState={[]} 
                editorName="Events" 
                EditorComponent={EventEditor} 
                writeTransformer={(data) => data.filter((e: any) => e.title && e.date)}
                setTabCount={(c) => setTabCounts(prev => ({ ...prev, events: c }))} 
              />
            )}
            {activeTab === "tournament" && <TournamentEditor />}
            {activeTab === "videos" && (
              <ContentEditorWrapper 
                dbKey="videos" 
                emptyState={[]} 
                editorName="Videos" 
                EditorComponent={VideoEditor} 
                writeTransformer={(data) => data.filter((v: any) => v.title && v.videoId)}
                setTabCount={(c) => setTabCounts(prev => ({ ...prev, videos: c }))} 
              />
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
      </div>
    </div>
  );
}
