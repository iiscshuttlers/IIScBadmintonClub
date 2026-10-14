import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ghost,
  Trash2,
  Shield,
  ShieldAlert,
  Users,
  Activity,
  Trophy,
  Paintbrush,
  ClipboardList,
  Settings,
  BarChart2,
  Zap,
  Sparkles,
  Undo2,
  Redo2,
  FileCode2,
  ExternalLink,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AdminHistoryProvider, useAdminHistory } from "@/contexts/AdminHistoryContext";
import { Database } from "lucide-react";

/* ── Lazy-loaded panels ─────────────────────────────────────────────
 * Each panel is code-split so visiting /admin no longer pulls the whole
 * admin bundle (TournamentManager, EloAuditPanel, the graph panels, …)
 * up front. They load on demand when their tab is opened.
 * React.lazy needs a default export, so named exports are remapped. */
const lazyNamed = <T extends Record<string, React.ComponentType<any>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((m) => ({ default: m[name] })));

// Direct panels
const PlayersManager = lazyNamed(() => import("@/components/admin/editors/PlayersManager"), "PlayersManager");
const MatchesManager = lazyNamed(() => import("@/components/admin/editors/MatchesManager"), "MatchesManager");
const ChangelogViewer = lazyNamed(() => import("@/components/admin/editors/ChangelogViewer"), "ChangelogViewer");
const ContentHub = lazyNamed(() => import("@/components/admin/ContentHub"), "ContentHub");

// Standalone panels
const UmpireTab = lazyNamed(() => import("@/components/umpire/UmpireTab"), "UmpireTab");
const AdminStatsOverview = lazyNamed(() => import("@/components/admin/AdminStatsOverview"), "AdminStatsOverview");
const InboxPanel = lazyNamed(() => import("@/components/admin/InboxPanel"), "InboxPanel");
const AdminSettings = lazyNamed(() => import("@/components/admin/AdminSettings"), "AdminSettings");
const AdminActivityLog = lazyNamed(() => import("@/components/admin/AdminActivityLog"), "AdminActivityLog");
const EloAuditPanel = lazyNamed(() => import("@/components/admin/EloAuditPanel"), "EloAuditPanel");
const AdminFeaturesPanel = lazyNamed(() => import("@/components/admin/AdminFeaturesPanel"), "AdminFeaturesPanel");
const FeaturesPanel = lazyNamed(() => import("@/components/admin/FeaturesPanel"), "FeaturesPanel");
const AnalyticsPanel = lazyNamed(() => import("@/components/admin/AnalyticsPanel"), "AnalyticsPanel");
const RecycleBin = lazyNamed(() => import("@/components/admin/RecycleBin"), "RecycleBin");
const GuestPlayersPanel = lazyNamed(() => import("@/components/admin/GuestPlayersPanel"), "GuestPlayersPanel");
const UndoHistory = lazyNamed(() => import("@/components/admin/UndoHistory"), "UndoHistory");
const RoleManagerPanel = lazyNamed(() => import("@/components/admin/RoleManagerPanel"), "RoleManagerPanel");
const DatabaseSchemaDashboard = lazyNamed(() => import("@/components/admin/DatabaseSchemaDashboard"), "DatabaseSchemaDashboard");
// HomeBannerManager, NoticeboardManager and the content editors are now composed
// inside ContentHub; FeatureMapDashboard + AdminAllFeaturesPanel inside FeaturesPanel.

/* ── Types ──────────────────────────────────────────────────────── */
type TabId =
  | "overview"
  | "content"
  | "tournament"
  | "players"
  | "guests"
  | "umpire"
  | "registrations"
  | "matches"
  | "changelog"
  | "inbox"
  | "elo_audit"
  | "settings"
  | "activity_log"
  | "features"
  | "features_catalog"
  | "recycle_bin"
  | "undo_history"
  | "database_schema"
  | "analytics"
  | "role_manager";

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
      { id: "elo_audit", label: "ELO Audit", icon: BarChart2 },
      { id: "analytics", label: "Analytics", icon: BarChart2 },
      { id: "inbox", label: "Inbox", icon: MessageSquare },
    ],
  },
  {
    title: "👥 Player Management",
    description: "Manage players, roles, and guests",
    tabs: [
      { id: "players", label: "Players", icon: Users },
      { id: "role_manager", label: "Role Manager", icon: ShieldAlert },
      { id: "guests", label: "Guests", icon: Ghost },
    ],
  },
  {
    title: "🏆 Tournaments & Matches",
    description: "Manage competitive play and live scoring",
    tabs: [
      { id: "tournament", label: "Tournament", icon: Trophy },
      { id: "matches", label: "Matches", icon: Trophy },
      { id: "umpire", label: "Umpire Mode", icon: Activity },
    ],
  },
  {
    title: "📝 Content & Media",
    description: "Manage club content, announcements, and events",
    tabs: [
      { id: "content", label: "Content", icon: Paintbrush },
    ],
  },
  {
    title: "⚙️ Settings & Admin",
    description: "System configuration, operations, and settings",
    tabs: [
      { id: "settings", label: "Settings", icon: Settings },
      { id: "activity_log", label: "Activity Log", icon: ClipboardList },
      { id: "undo_history", label: "Undo History", icon: Undo2 },
      { id: "recycle_bin", label: "Recycle Bin", icon: Trash2 },
    ],
  },
  {
    title: "🛠️ Developer Hub",
    description: "System architecture and codebase features",
    tabs: [
      { id: "features_catalog", label: "Features", icon: Sparkles },
      { id: "features", label: "Live Ops", icon: Zap },
      { id: "database_schema", label: "Database Schema", icon: Database },
      { id: "changelog", label: "System Logs", icon: FileCode2 },
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
  const [location, setLocation] = useLocation();

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const { session, isInitializing, isAdmin, isMasterAdmin, isUmpire } = useAuth();
  const { canUndo, canRedo, undo, redo, recycleBinCount, lastAction, nextRedoAction } = useAdminHistory();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace("#", "");
    const baseHash = hash.split("/")[0];
    if (TABS.some(t => t.id === baseHash)) return baseHash as TabId;
    return isAdmin ? "overview" : "umpire";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      const baseHash = hash.split("/")[0];
      if (TABS.some(t => t.id === baseHash)) setActiveTab(baseHash as TabId);
    };
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", `#${activeTab}`);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    // Clear query parameters when switching main tabs so sub-tab state (like Noticeboard's ?tab=events) doesn't persist inappropriately
    window.history.pushState(null, "", `${window.location.pathname}#${tabId}`);
    
    // Manually dispatch a hashchange event in case any other components are listening
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const [waffleOpen, setWaffleOpen] = useState(false);
  const waffleRef = useRef<HTMLDivElement>(null);
  useClickOutside(waffleRef, () => setWaffleOpen(false), waffleOpen);


  useEffect(() => {
    if (isInitializing) setAuthState("loading");
    else if (session) {
      if (isMasterAdmin) setAuthState("ok");
      else if (activeTab === "role_manager" || activeTab === "database_schema") setAuthState("denied");
      else if (activeTab === "umpire") setAuthState(isUmpire ? "ok" : "denied");
      else setAuthState(isAdmin ? "ok" : "denied");
    } else setAuthState("denied");
  }, [session, isInitializing, isAdmin, isMasterAdmin, isUmpire, activeTab]);

  if (authState === "loading")
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );

  if (authState === "denied")
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-xl max-w-md">
          <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-foreground dark:text-foreground mb-2">Admin Access Required</h1>
          <p className="text-muted-foreground dark:text-muted-foreground mb-6">
            {session ? "Your account does not have admin privileges." : "You need to be signed in with an admin account."}
          </p>
          {!session ? (
            <button
              onClick={() => {
                sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
                setLocation("/join");
              }}
              className="px-6 py-3 bg-primary hover:bg-primary text-primary-foreground font-bold rounded-xl transition shadow-lg shadow-primary/20"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
              className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-on-accent font-bold rounded-xl transition shadow-lg shadow-slate-500/20"
            >
              Back to Home
            </button>
          )}
        </div>
      </div>
    );

  const getTabCount = (tabId: string) => {
    if (tabId === "recycle_bin") return recycleBinCount > 0 ? recycleBinCount : null;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-safe pb-24 lg:pb-8">
      {/* Header */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-primary/80 text-on-accent py-10 md:sticky md:top-[48px] lg:top-[88px] md:z-40 shadow-xl border-b border-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest mb-2">
                <Shield className="w-4 h-4" /> Admin Panel
              </div>
              <div className="flex items-center gap-3">
                {/* Waffle launcher */}
                <div className="relative" ref={waffleRef}>
                  <button
                    onClick={() => setWaffleOpen(o => !o)}
                    title="All admin sections"
                    className={`p-2 rounded-xl transition border ${waffleOpen ? "bg-white/20 border-white/30" : "bg-white/10 hover:bg-white/20 border-white/10 hover:border-white/30"}`}
                  >
                    <LayoutGrid className="w-6 h-6 text-foreground" />
                  </button>

                  <AnimatePresence>
                    {waffleOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 z-50 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
                        style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}
                      >
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-widest">Admin Sections</p>
                        </div>
                        <div className="p-3" style={{ paddingBottom: "100px" }}>
                          <div className="space-y-4">
                          {TAB_GROUPS.map((group) => {
                            const visibleTabs = group.tabs.filter((tab) => {
                              if (tab.id === "role_manager" || tab.id === "database_schema") return isMasterAdmin;
                              return isAdmin || tab.id === "umpire";
                            });
                            if (visibleTabs.length === 0) return null;
                            return (
                              <div key={group.title}>
                                <p className="text-[10px] font-black text-muted-foreground dark:text-muted-foreground uppercase tracking-widest px-1 mb-2">{group.title}</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {visibleTabs.map((tab) => {
                                    const Icon = tab.icon;
                                    const active = activeTab === tab.id;
                                    const count = getTabCount(tab.id);
                                    return (
                                      <button
                                        key={tab.id}
                                        onClick={() => { handleTabChange(tab.id); setWaffleOpen(false); }}
                                        className={`relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-[11px] font-bold transition-all ${
                                          active
                                            ? "bg-primary/10 dark:bg-primary/40 text-primary dark:text-primary border border-primary/40 dark:border-primary/80"
                                            : "text-muted-foreground dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                                        }`}
                                      >
                                        <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                                        <span className="text-center leading-tight">{tab.label}</span>
                                        {count !== null && (
                                          <span className="absolute top-1 right-1 text-[9px] px-1 py-0.5 rounded-full font-black bg-primary text-primary-foreground leading-none">{count}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Control Center</h1>
              </div>
              <p className="text-slate-300 text-sm mt-1">Site content · Player management · Live tournament scoring</p>
            </div>
            <div className="flex flex-col sm:items-end items-start gap-1 w-full sm:w-auto mt-2 sm:mt-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleTabChange("players")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-bold transition"
                  title="Manage Players"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Players</span>
                </button>
                {isMasterAdmin && (
                  <button
                    onClick={() => handleTabChange("role_manager")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm font-bold transition"
                    title="Manage Roles"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span className="hidden lg:inline">Roles</span>
                  </button>
                )}
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title={canUndo && lastAction ? `Undo: ${lastAction.label}` : "Undo last saved action (Ctrl+Z)"}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Undo2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title={canRedo && nextRedoAction ? `Redo: ${nextRedoAction.label}` : "Redo (Ctrl+Y)"}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Redo2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Redo</span>
                </button>
              </div>
              {(canUndo || canRedo) && (
                <div className="text-[10px] text-primary/70 font-medium w-full sm:max-w-[300px] sm:text-right text-left leading-tight break-words">
                  {canUndo && <div><span className="opacity-70">Undo:</span> {lastAction?.label}</div>}
                  {canRedo && <div><span className="opacity-70">Redo:</span> {nextRedoAction?.label}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb */}
        {(() => {
          const activeGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab));
          const activeTabMeta = TABS.find(t => t.id === activeTab);
          const ActiveIcon = activeTabMeta?.icon;
          return (
            <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground dark:text-muted-foreground">
              <button 
                onClick={() => setWaffleOpen(true)}
                className="text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary transition-colors cursor-pointer"
                title="View all admin sections"
              >
                {activeGroup?.title ?? ""}
              </button>
              <span className="text-slate-300 dark:text-muted-foreground">›</span>
              <span className="font-bold text-muted-foreground dark:text-slate-200">{activeTabMeta?.label}</span>
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
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
              }
            >
            {activeTab === "overview" && isAdmin && <AdminStatsOverview />}
            {activeTab === "content" && <ContentHub />}
            {activeTab === "tournament" && (
              <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                  <Trophy className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-black text-foreground">Tournament Manager</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Create and run tournaments, brackets, participants and results in the
                  dedicated full-screen workspace.
                </p>
                <button
                  onClick={() => setLocation("/tournament-admin")}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600"
                >
                  <Trophy className="h-4 w-4" />
                  Open Tournament Manager
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </button>
              </div>
            )}
            {activeTab === "players" && <PlayersManager />}
            {activeTab === "role_manager" && <RoleManagerPanel />}
            {activeTab === "guests" && <GuestPlayersPanel />}
            {activeTab === "matches" && <MatchesManager />}
            {activeTab === "inbox" && <InboxPanel />}
            {activeTab === "analytics" && <AnalyticsPanel />}
            {activeTab === "elo_audit" && <EloAuditPanel />}
            {activeTab === "umpire" && <UmpireTab />}
            {activeTab === "settings" && <AdminSettings />}
            {activeTab === "activity_log" && <AdminActivityLog />}
            {activeTab === "changelog" && <ChangelogViewer />}
            {activeTab === "features" && <AdminFeaturesPanel />}
            {activeTab === "features_catalog" && <FeaturesPanel />}
            {activeTab === "database_schema" && <DatabaseSchemaDashboard />}
            {activeTab === "undo_history" && <UndoHistory />}
            {activeTab === "recycle_bin" && <RecycleBin />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

