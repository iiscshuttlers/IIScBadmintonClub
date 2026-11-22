import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { BackButton } from "@/components/ui/BackButton";
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
  Pin,
  PinOff,
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
const AdminActionCards = lazyNamed(() => import("@/components/admin/AdminActionCards"), "AdminActionCards");
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
// The content editors (banners, posts, polls, calendar, club page) are composed
// inside ContentHub around one shared draft; FeatureMapDashboard + AdminAllFeaturesPanel inside FeaturesPanel.

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
  color: string;
  tabs: SectionMeta[];
}

/**
 * Every panel the console can show. Panel ids are the URL hash (#elo_audit),
 * so bookmarks and deep links from before the regroup still open the same
 * panel. The sidebar lists SECTIONS (below), each holding one or more panels.
 */
const TABS: TabMeta[] = [
  { id: "overview", label: "Statistics", icon: Activity, description: "Key club metrics and ELO distribution" },
  { id: "analytics", label: "Analytics", icon: TrendingUp, description: "Engagement, retention, usage trends and top pages" },
  { id: "elo_audit", label: "ELO Audit", icon: BarChart2, description: "Audit ELO changes across match history" },
  { id: "inbox", label: "Inbox", icon: MessageSquare, description: "Feedback, disputes and moderation queue" },
  { id: "players", label: "Players", icon: Users, description: "Approve, manage and profile all players" },
  { id: "role_manager", label: "Role Manager", icon: ShieldAlert, master: true, description: "Grant and revoke admin or umpire roles" },
  { id: "guests", label: "Guests", icon: Ghost, description: "Manage unregistered guest players" },
  { id: "tournament", label: "Tournaments", icon: Trophy, description: "Create and manage tournament brackets" },
  { id: "matches", label: "Matches", icon: Swords, description: "Review, edit and delete match records" },
  { id: "umpire", label: "Umpire Mode", icon: Gavel, description: "Live scoring mode for match officials" },
  { id: "content", label: "Content", icon: Paintbrush, description: "Banners, polls, notices and media" },
  { id: "settings", label: "Settings", icon: Settings, description: "Club configuration and feature flags" },
  { id: "activity_log", label: "Activity Log", icon: ClipboardList, description: "Audit trail of all admin actions" },
  { id: "undo_history", label: "Undo History", icon: Undo2, description: "Browse and undo recent admin changes" },
  { id: "recycle_bin", label: "Recycle Bin", icon: Trash2, description: "Restore recently soft-deleted records" },
  { id: "features", label: "Live Ops", icon: Zap, description: "Live scores, notifications, public API and DB health" },
  { id: "features_catalog", label: "Features", icon: Sparkles, description: "Browse and manage all feature flags" },
  { id: "delivery", label: "Delivery Audit", icon: Radio, description: "Cron-job health and notification delivery" },
  { id: "changelog", label: "System Logs", icon: FileCode2, description: "System change logs and deploy history" },
  { id: "database_schema", label: "Database Schema", icon: Database, master: true, description: "Inspect the live database schema" },
];
const PANEL_META = new Map<TabId, TabMeta>(TABS.map((t) => [t.id, t]));

/** One sidebar entry: a single panel, or several behind a sub-switch. */
type SectionId =
  | "insights" | "inbox"
  | "players" | "role_manager" | "guests"
  | "tournament" | "matches" | "umpire"
  | "content"
  | "settings" | "history" | "developer";
interface SectionMeta {
  id: SectionId;
  label: string;
  icon: any;
  description: string;
  panels: TabId[];
  /** Only master admins see this section (every panel in it is master-only). */
  master?: boolean;
}

/** 12 sections in 5 groups (was 19 tabs in 6 groups until the 22 Nov 2026 regroup). */
const TAB_GROUPS: TabGroup[] = [
  {
    title: "Dashboard",
    color: "text-info",
    tabs: [
      { id: "insights", label: "Insights", icon: Activity, description: "Statistics, analytics and the ELO audit", panels: ["overview", "analytics", "elo_audit"] },
      { id: "inbox", label: "Inbox", icon: MessageSquare, description: "Feedback, disputes and moderation queue", panels: ["inbox"] },
    ],
  },
  {
    title: "People",
    color: "text-individual",
    tabs: [
      { id: "players", label: "Players", icon: Users, description: "Approve, manage and profile all players", panels: ["players"] },
      { id: "role_manager", label: "Role Manager", icon: ShieldAlert, master: true, description: "Grant and revoke admin or umpire roles", panels: ["role_manager"] },
      { id: "guests", label: "Guests", icon: Ghost, description: "Manage unregistered guest players", panels: ["guests"] },
    ],
  },
  {
    title: "Competition",
    color: "text-warning",
    tabs: [
      { id: "tournament", label: "Tournaments", icon: Trophy, description: "Create and manage tournament brackets", panels: ["tournament"] },
      { id: "matches", label: "Matches", icon: Swords, description: "Review, edit and delete match records", panels: ["matches"] },
      { id: "umpire", label: "Umpire Mode", icon: Gavel, description: "Live scoring mode for match officials", panels: ["umpire"] },
    ],
  },
  {
    title: "Content",
    color: "text-individual",
    tabs: [{ id: "content", label: "Content", icon: Paintbrush, description: "Banners, polls, notices and media", panels: ["content"] }],
  },
  {
    title: "System",
    color: "text-success",
    tabs: [
      { id: "settings", label: "Settings", icon: Settings, description: "Club configuration and feature flags", panels: ["settings"] },
      { id: "history", label: "History", icon: ClipboardList, description: "Activity log, undo history and the recycle bin", panels: ["activity_log", "undo_history", "recycle_bin"] },
      { id: "developer", label: "Developer", icon: Zap, description: "Live ops, feature flags, delivery, logs and schema", panels: ["features", "features_catalog", "delivery", "changelog", "database_schema"] },
    ],
  },
];

const SECTIONS: SectionMeta[] = TAB_GROUPS.flatMap((group) => group.tabs);
const SECTION_OF = new Map<TabId, SectionId>(SECTIONS.flatMap((s) => s.panels.map((p) => [p, s.id] as const)));

const PINNED_STORAGE_KEY = "admin-pinned-tabs";

/** Pins hold section ids; pins saved before the regroup (panel ids) map to their section. */
function loadPinnedTabs(): SectionId[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const out: SectionId[] = [];
    for (const id of ids) {
      const section = SECTIONS.some((s) => s.id === id) ? (id as SectionId) : SECTION_OF.get(id as TabId);
      if (section && !out.includes(section)) out.push(section);
    }
    return out;
  } catch { return []; }
}

function savePinnedTabs(pins: SectionId[]) {
  try { localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pins)); } catch { /* intentional — localStorage quota or restricted private mode, pinned tabs are non-critical */ }
}

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
  onSelect: (id: SectionId) => void;
  canSee: (s: SectionMeta) => boolean;
  getTabCount: (id: SectionId) => number | null;
}) {
  const [query, setQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<SectionId[]>(loadPinnedTabs);
  const q = query.trim().toLowerCase();
  const activeSection = SECTION_OF.get(activeTab);
  // Search matches a section by its own name, its group, or any panel inside it.
  const matches = (s: SectionMeta, groupTitle: string) =>
    !q ||
    s.label.toLowerCase().includes(q) ||
    groupTitle.toLowerCase().includes(q) ||
    s.panels.some((p) => PANEL_META.get(p)?.label.toLowerCase().includes(q));

  const togglePin = useCallback((id: SectionId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      savePinnedTabs(next);
      return next;
    });
  }, []);

  const groups = useMemo(() => {
    return TAB_GROUPS.map((group) => ({
      ...group,
      tabs: group.tabs.filter((t) => canSee(t) && matches(t, group.title)),
    })).filter((g) => g.tabs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, canSee]);

  const pinnedTabs = useMemo(() => {
    if (q) return [];
    return pinnedIds
      .map((id) => SECTIONS.find((s) => s.id === id))
      .filter((s): s is SectionMeta => !!s && canSee(s));
  }, [pinnedIds, q, canSee]);

  const renderTab = (tab: SectionMeta, pinned: boolean) => {
    const Icon = tab.icon;
    const active = activeSection === tab.id;
    const count = getTabCount(tab.id);
    const isPinned = pinnedIds.includes(tab.id);
    return (
      <button
        key={tab.id}
        onClick={() => onSelect(tab.id)}
        className={`group/tab flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          active
            ? "bg-primary/20 text-primary"
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
          <span title="Master admin only" className="inline-flex shrink-0">
            <ShieldAlert className="h-3.5 w-3.5 text-warning opacity-70" aria-label="Master admin only" />
          </span>
        )}
        <span
          role="button"
          title={isPinned ? "Unpin" : "Pin to top"}
          onClick={(e) => { e.stopPropagation(); togglePin(tab.id); }}
          className={`shrink-0 rounded-md p-0.5 transition ${
            isPinned
              ? "text-primary opacity-80 hover:opacity-100"
              : "opacity-0 group-hover/tab:opacity-60 hover:!opacity-100"
          }`}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </span>
      </button>
    );
  };

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

        {/* Pinned section */}
        {pinnedTabs.length > 0 && (
          <div>
            <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <Pin className="mr-1 inline h-3 w-3" />
              Pinned
            </p>
            <div className="space-y-0.5">
              {pinnedTabs.map((tab) => renderTab(tab, true))}
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.title}>
            <p className={`mb-1.5 px-2 text-[10px] font-black uppercase tracking-widest ${group.color}`}>
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.tabs.map((tab) => renderTab(tab, false))}
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
          <Shield className="mx-auto mb-4 h-16 w-16 text-danger" />
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
            <BackButton
              parent="/"
              className="rounded-xl bg-muted px-6 py-3 font-bold text-foreground transition hover:bg-muted/80"
            >
              Back
            </BackButton>
          )}
        </div>
      </div>
    );

  const getTabCount = (sectionId: SectionId) => {
    if (sectionId === "history") return recycleBinCount > 0 ? recycleBinCount : null;
    return null;
  };

  const canSeePanel = (t: TabMeta | undefined) => {
    if (!t) return false;
    if (t.master) return isMasterAdmin;
    return isAdmin || t.id === "umpire";
  };
  const canSee = (s: SectionMeta) => s.panels.some((p) => canSeePanel(PANEL_META.get(p)));

  /** Sidebar click: stay put if already in that section, else open its first panel you can see. */
  const handleSectionSelect = (sectionId: SectionId) => {
    const section = SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    if (section.panels.includes(activeTab)) { setDrawerOpen(false); return; }
    const first = section.panels.find((p) => canSeePanel(PANEL_META.get(p)));
    if (first) handleTabChange(first);
  };

  const activeSection = SECTIONS.find((s) => s.panels.includes(activeTab));
  const activeGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.id === activeSection?.id));
  const activeMeta = TABS.find((t) => t.id === activeTab);
  const sectionPanels = (activeSection?.panels ?? [])
    .map((p) => PANEL_META.get(p))
    .filter((t): t is TabMeta => canSeePanel(t));
  const roleLabel = isMasterAdmin ? "Master Admin" : isAdmin ? "Admin" : isUmpire ? "Umpire" : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:flex">
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside className="sticky top-[48px] hidden h-[calc(100vh-48px)] w-72 shrink-0 border-r border-border bg-card lg:top-[72px] lg:block lg:h-[calc(100vh-72px)]">
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
            <AdminNav activeTab={activeTab} onSelect={handleSectionSelect} canSee={canSee} getTabCount={getTabCount} />
          </div>
        </aside>

        {/* ── Main column ─────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          {/* Slim top bar */}
          <header className="sticky top-[48px] z-30 border-b border-border bg-card/80 backdrop-blur-md lg:top-[72px]">
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
                  {sectionPanels.length > 1 ? activeSection?.label : activeMeta?.label ?? "Admin"}
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
            {/* Panels inside a merged section (Insights, History, Developer) */}
            {sectionPanels.length > 1 && (
              <div role="group" aria-label={`${activeSection?.label ?? "Section"} panels`} className="flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6">
                {sectionPanels.map((panel) => {
                  const Icon = panel.icon;
                  const active = panel.id === activeTab;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      onClick={() => handleTabChange(panel.id)}
                      aria-pressed={active}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {panel.label}
                      {panel.id === "recycle_bin" && recycleBinCount > 0 && (
                        <span className="rounded-full bg-background/30 px-1.5 text-[10px] font-black leading-4">{recycleBinCount}</span>
                      )}
                      {panel.master && <ShieldAlert className="h-3 w-3 opacity-70" aria-label="Master admin only" />}
                    </button>
                  );
                })}
              </div>
            )}
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
                  {activeTab === "overview" && isAdmin && (
                    <>
                      <AdminActionCards
                        onOpenTab={(tab) => {
                          const resolved = resolveTab(tab);
                          if (resolved) handleTabChange(resolved);
                        }}
                      />
                      <AdminStatsOverview />
                    </>
                  )}
                  {activeTab === "content" && <ContentHub />}
                  {activeTab === "tournament" && (
                    <div className="rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/10 to-card p-8 text-center shadow-sm">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                        <Trophy className="h-7 w-7" />
                      </div>
                      <h2 className="text-xl font-black text-foreground">Tournament Manager</h2>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        Create and run tournaments, brackets, participants and results in the dedicated
                        full-screen workspace.
                      </p>
                      <button
                        onClick={() => setLocation("/tournament-admin")}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-lg shadow-gold/20 transition hover:bg-gold/90"
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
              className="fixed inset-0 z-[60] bg-media/50 lg:hidden"
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
                <AdminNav activeTab={activeTab} onSelect={handleSectionSelect} canSee={canSee} getTabCount={getTabCount} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
