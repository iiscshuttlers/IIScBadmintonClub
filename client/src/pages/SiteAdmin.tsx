import { useEffect, useState, useMemo, lazy, Suspense } from "react";
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
  TrendingUp,
  Zap,
  Sparkles,
  Undo2,
  Redo2,
  FileCode2,
  ExternalLink,
  MessageSquare,
  Menu,
  X,
  Search,
  Database,
  Gavel,
  Swords,
  Home,
  Radio,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AdminHistoryProvider, useAdminHistory } from "@/contexts/AdminHistoryContext";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";

/* ── Lazy-loaded panels ─────────────────────────────────────────────
 * Each panel is code-split so visiting /admin no longer pulls the whole
 * admin bundle (TournamentManager, EloAuditPanel, the hub panels, …)
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
const DeliveryAuditPanel = lazyNamed(() => import("@/components/admin/DeliveryAuditPanel"), "DeliveryAuditPanel");
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
  | "delivery"
  | "role_manager";

interface TabMeta {
  id: TabId;
  label: string;
  icon: any;
  description?: string;
  /** Only master admins may see/open this tab. */
  master?: boolean;
}
interface TabGroup {
  title: string;
  tabs: TabMeta[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    title: "Dashboard",
    tabs: [
      { id: "overview", label: "Statistics", icon: Activity, description: "Key club metrics and ELO distribution" },
      { id: "elo_audit", label: "ELO Audit", icon: BarChart2, description: "Audit ELO changes across match history" },
      { id: "analytics", label: "Analytics", icon: TrendingUp, description: "Engagement, retention and usage trends" },
      { id: "inbox", label: "Inbox", icon: MessageSquare, description: "Feedback, disputes and moderation queue" },
    ],
  },
  {
    title: "People",
    tabs: [
      { id: "players", label: "Players", icon: Users, description: "Approve, manage and profile all players" },
      { id: "role_manager", label: "Role Manager", icon: ShieldAlert, master: true, description: "Grant and revoke admin or umpire roles" },
      { id: "guests", label: "Guests", icon: Ghost, description: "Manage unregistered guest players" },
    ],
  },
  {
    title: "Competition",
    tabs: [
      { id: "tournament", label: "Tournaments", icon: Trophy, description: "Create and manage tournament brackets" },
      { id: "matches", label: "Matches", icon: Swords, description: "Review, edit and delete match records" },
      { id: "umpire", label: "Umpire Mode", icon: Gavel, description: "Live scoring mode for match officials" },
    ],
  },
  {
    title: "Content",
    tabs: [{ id: "content", label: "Content", icon: Paintbrush, description: "Banners, polls, notices and media" }],
  },
  {
    title: "System",
    tabs: [
      { id: "settings", label: "Settings", icon: Settings, description: "Club configuration and feature flags" },
      { id: "activity_log", label: "Activity Log", icon: ClipboardList, description: "Audit trail of all admin actions" },
      { id: "undo_history", label: "Undo History", icon: Undo2, description: "Browse and undo recent admin changes" },
      { id: "recycle_bin", label: "Recycle Bin", icon: Trash2, description: "Restore recently soft-deleted records" },
      { id: "changelog", label: "System Logs", icon: FileCode2, description: "System change logs and deploy history" },
    ],
  },
  {
    title: "Developer",
    tabs: [
      { id: "features_catalog", label: "Features", icon: Sparkles, description: "Browse and manage all feature flags" },
      { id: "features", label: "Live Ops", icon: Zap, description: "Toggle live feature flags in real time" },
      { id: "delivery", label: "Delivery Audit", icon: Radio, description: "Cron-job health and notification delivery" },
      { id: "database_schema", label: "Database Schema", icon: Database, master: true, description: "Inspect the live database schema" },
    ],
  },
];

const TABS: TabMeta[] = TAB_GROUPS.flatMap((group) => group.tabs);

/** Old hash routes that no longer map 1:1 after the tab merges. Keeps
 *  existing bookmarks / deep-links working by redirecting to the new home. */
const HASH_ALIASES: Record<string, TabId> = {
  // Content hub
  config: "content",
  noticeboard: "content",
  home_banners: "content",
  polls: "content",
  holidays: "content",
  videos: "content",
  convener_photos: "content",
  // Inbox
  feedback: "inbox",
  moderation: "inbox",
  disputes: "inbox",
  // Features
  all_features: "features_catalog",
  feature_registry: "features_catalog",
  // Deleted Developer Hub panels → nearest surviving home
  architecture: "features_catalog",
  neural_graph: "features_catalog",
  features_guide: "features_catalog",
  tooltips: "settings",
};

function resolveTab(rawHash: string): TabId | null {
  const base = rawHash.replace("#", "").split("/")[0];
  if (!base) return null;
  if (TABS.some((t) => t.id === base)) return base as TabId;
  if (HASH_ALIASES[base]) return HASH_ALIASES[base];
  return null;
}

/* ================================================================ */
/*  Navigation (shared by desktop sidebar + mobile drawer)           */
/* ================================================================ */
function AdminNav({
  activeTab,
  onSelect,
  canSee,
  getTabCount,
}: {
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  canSee: (t: TabMeta) => boolean;
  getTabCount: (id: string) => number | null;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return TAB_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter(
        (t) => canSee(t) && (!q || t.label.toLowerCase().includes(q) || group.title.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.tabs.length > 0);
  }, [q, canSee]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-2">
        {groups.length === 0 && (
          <p className="px-1 pt-4 text-sm text-muted-foreground">No sections match {`"${query}"`}.</p>
        )}
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const count = getTabCount(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelect(tab.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-primary/10 text-primary dark:bg-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {count !== null && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-primary-foreground">
                        {count}
                      </span>
                    )}
                    {tab.master && (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400 opacity-70" title="Master admin only" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Back to site */}
      <div className="border-t border-border px-3 py-3">
        <a
          href="/"
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Home className="h-[15px] w-[15px] shrink-0" />
          Back to site
        </a>
      </div>
    </div>
  );
}

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
    return resolveTab(window.location.hash) ?? (isAdmin ? "overview" : "umpire");
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const resolved = resolveTab(window.location.hash);
      if (resolved) setActiveTab(resolved);
    };
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) window.history.replaceState(null, "", `#${activeTab}`);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setDrawerOpen(false);
    // Clear query params when switching main tabs so sub-tab state doesn't persist.
    window.history.pushState(null, "", `${window.location.pathname}#${tabId}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  // Lock body scroll + close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  if (authState === "denied")
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
          <Shield className="mx-auto mb-4 h-16 w-16 text-rose-500" />
          <h1 className="mb-2 text-2xl font-black text-foreground">Admin Access Required</h1>
          <p className="mb-6 text-muted-foreground">
            {session ? "Your account does not have admin privileges." : "You need to be signed in with an admin account."}
          </p>
          {!session ? (
            <button
              onClick={() => {
                sessionStorage.setItem("return_url", location + window.location.search + window.location.hash);
                setLocation("/join");
              }}
              className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => (window.history.length > 1 ? window.history.back() : setLocation("/"))}
              className="rounded-xl bg-muted px-6 py-3 font-bold text-foreground transition hover:bg-muted/80"
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

  const canSee = (t: TabMeta) => {
    if (t.master) return isMasterAdmin;
    return isAdmin || t.id === "umpire";
  };

  const activeGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.id === activeTab));
  const activeMeta = TABS.find((t) => t.id === activeTab);
  const roleLabel = isMasterAdmin ? "Master Admin" : isAdmin ? "Admin" : isUmpire ? "Umpire" : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:flex">
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside className="sticky top-[48px] hidden h-[calc(100vh-48px)] w-72 shrink-0 border-r border-border bg-card lg:top-[88px] lg:block lg:h-[calc(100vh-88px)]">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-foreground">Control Center</p>
              {roleLabel && <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>}
            </div>
          </div>
          <div className="h-[calc(100%-65px)]">
            <AdminNav activeTab={activeTab} onSelect={handleTabChange} canSee={canSee} getTabCount={getTabCount} />
          </div>
        </aside>

        {/* ── Main column ─────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          {/* Slim top bar */}
          <header className="sticky top-[48px] z-30 border-b border-border bg-card/80 backdrop-blur-md lg:top-[88px]">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                onClick={() => setDrawerOpen(true)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
                title="Open sections"
                aria-label="Open admin sections"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {activeGroup?.title ?? "Admin"}
                </p>
                <h1 className="truncate text-lg font-black leading-tight text-foreground sm:text-xl">
                  {activeMeta?.label ?? "Admin"}
                </h1>
                {activeMeta?.description && (
                  <p className="truncate text-[11px] text-muted-foreground">{activeMeta.description}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title={canUndo && lastAction ? `Undo: ${lastAction.label}` : "Undo (Ctrl+Z)"}
                  className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title={canRedo && nextRedoAction ? `Redo: ${nextRedoAction.label}` : "Redo (Ctrl+Y)"}
                  className="rounded-lg border border-border p-2 text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <AdminErrorBoundary panelLabel={activeMeta?.label}>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-24">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                  }
                >
                  {activeTab === "overview" && isAdmin && <AdminStatsOverview />}
                  {activeTab === "content" && <ContentHub />}
                  {activeTab === "tournament" && (
                    <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-50 to-white p-8 text-center shadow-sm dark:from-amber-950/20 dark:to-slate-900">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                        <Trophy className="h-7 w-7" />
                      </div>
                      <h2 className="text-xl font-black text-foreground">Tournament Manager</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        Create and run tournaments, brackets, participants and results in the dedicated
                        full-screen workspace.
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
                  {activeTab === "delivery" && <DeliveryAuditPanel />}
                  {activeTab === "undo_history" && <UndoHistory />}
                  {activeTab === "recycle_bin" && <RecycleBin />}
                </Suspense>
                </AdminErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── Mobile drawer ───────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              role="dialog"
              aria-modal="true"
              aria-label="Admin sections"
              className="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-card shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-foreground">Control Center</p>
                    {roleLabel && <p className="text-[11px] text-muted-foreground">{roleLabel}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close sections"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AdminNav activeTab={activeTab} onSelect={handleTabChange} canSee={canSee} getTabCount={getTabCount} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
