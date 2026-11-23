import {
  Activity,
  BarChart2,
  ClipboardList,
  Database,
  FileCode2,
  Gavel,
  Ghost,
  LayoutDashboard,
  MessageSquare,
  Paintbrush,
  Radio,
  Settings,
  ShieldAlert,
  Sparkles,
  Swords,
  Terminal,
  Trash2,
  TrendingUp,
  Trophy,
  Undo2,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin console navigation (/admin). Panel ids are the URL hash (#elo_audit),
 * so bookmarks keep working across regroups; the sidebar lists SECTIONS, each
 * holding one or more panels shown as pills under the header.
 *
 * 23 Nov 2026 revamp: 8 sections in 2 groups (was 11 in 5). Home is the
 * landing page (what needs attention, quick actions, recent activity).
 */
export type TabId =
  | "overview"
  | "stats"
  | "content"
  | "tournament"
  | "players"
  | "guests"
  | "umpire"
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

export interface TabMeta {
  id: TabId;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Only master admins may see/open this panel. */
  master?: boolean;
}

export const TABS: TabMeta[] = [
  { id: "overview", label: "Home", icon: LayoutDashboard, description: "What needs attention, quick actions and recent activity" },
  { id: "tournament", label: "Tournaments", icon: Trophy, description: "Create and manage tournament brackets" },
  { id: "matches", label: "Matches", icon: Swords, description: "Review, edit and correct match records" },
  { id: "umpire", label: "Umpire Mode", icon: Gavel, description: "Live scoring mode for match officials" },
  { id: "players", label: "Players", icon: Users, description: "Approve, manage and profile all players" },
  { id: "guests", label: "Guests & claims", icon: Ghost, description: "Guest players, profile claims and merges" },
  { id: "role_manager", label: "Roles", icon: ShieldAlert, master: true, description: "Grant and revoke admin or umpire roles" },
  { id: "content", label: "Content", icon: Paintbrush, description: "Banners, posts, polls, calendar and the club page" },
  { id: "inbox", label: "Inbox", icon: MessageSquare, description: "Feedback and reports from members" },
  { id: "stats", label: "Statistics", icon: Activity, description: "Key club metrics and ELO distribution" },
  { id: "analytics", label: "Analytics", icon: TrendingUp, description: "Engagement, retention, usage trends and top pages" },
  { id: "elo_audit", label: "ELO Audit", icon: BarChart2, description: "Audit ELO changes across match history" },
  { id: "settings", label: "Settings", icon: Settings, description: "Maintenance, update prompt, public pages and data export" },
  { id: "delivery", label: "Delivery & jobs", icon: Radio, description: "Scheduled jobs and notification delivery" },
  { id: "features", label: "Live Ops", icon: Zap, description: "Live matches, public API and database health" },
  { id: "features_catalog", label: "Features", icon: Sparkles, description: "Browse and manage all feature flags" },
  { id: "activity_log", label: "Activity Log", icon: ClipboardList, description: "Audit trail of all admin actions" },
  { id: "undo_history", label: "Undo History", icon: Undo2, description: "Browse and undo recent admin changes" },
  { id: "recycle_bin", label: "Recycle Bin", icon: Trash2, description: "Restore recently soft-deleted records" },
  { id: "changelog", label: "System Logs", icon: FileCode2, description: "System change logs and deploy history" },
  { id: "database_schema", label: "Database Schema", icon: Database, master: true, description: "Inspect the live database schema" },
];
export const PANEL_META = new Map<TabId, TabMeta>(TABS.map((t) => [t.id, t]));

/** One sidebar entry: a single panel, or several behind pills. */
export type SectionId = "home" | "tournament" | "people" | "content" | "insights" | "system" | "history" | "developer";
export interface SectionMeta {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  description: string;
  panels: TabId[];
}
export interface TabGroup {
  title: string;
  color: string;
  tabs: SectionMeta[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    title: "Club",
    color: "text-info",
    tabs: [
      { id: "home", label: "Home", icon: LayoutDashboard, description: "What needs attention, quick actions and recent activity", panels: ["overview"] },
      { id: "tournament", label: "Tournaments", icon: Trophy, description: "Tournaments, match corrections and umpire mode", panels: ["tournament", "matches", "umpire"] },
      { id: "people", label: "People", icon: Users, description: "Players, guests and claims, and roles", panels: ["players", "guests", "role_manager"] },
      { id: "content", label: "Content & inbox", icon: Paintbrush, description: "What members see, and what they send you", panels: ["content", "inbox"] },
      { id: "insights", label: "Insights", icon: TrendingUp, description: "Statistics, analytics and the ELO audit", panels: ["stats", "analytics", "elo_audit"] },
    ],
  },
  {
    title: "System",
    color: "text-success",
    tabs: [
      { id: "system", label: "System", icon: Settings, description: "Settings, delivery and jobs, live ops and feature flags", panels: ["settings", "delivery", "features", "features_catalog"] },
      { id: "history", label: "History", icon: ClipboardList, description: "Activity log, undo history and the recycle bin", panels: ["activity_log", "undo_history", "recycle_bin"] },
      { id: "developer", label: "Developer", icon: Terminal, description: "System logs and the database schema", panels: ["changelog", "database_schema"] },
    ],
  },
];

export const SECTIONS: SectionMeta[] = TAB_GROUPS.flatMap((group) => group.tabs);
export const SECTION_OF = new Map<TabId, SectionId>(SECTIONS.flatMap((s) => s.panels.map((p) => [p, s.id] as const)));

/**
 * Hashes that no longer map 1:1 after the tab merges. Keeps bookmarks and
 * deep links working by redirecting to the panel's new home.
 */
export const HASH_ALIASES: Record<string, TabId> = {
  // Section names typed or linked as hashes
  home: "overview",
  insights: "stats",
  statistics: "stats",
  people: "players",
  roles: "role_manager",
  system: "settings",
  health: "delivery",
  history: "activity_log",
  developer: "changelog",
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

export function resolveTab(rawHash: string): TabId | null {
  const base = rawHash.replace("#", "").split("/")[0];
  if (!base) return null;
  if (TABS.some((t) => t.id === base)) return base as TabId;
  if (HASH_ALIASES[base]) return HASH_ALIASES[base];
  return null;
}

export interface AdminRoles {
  isAdmin: boolean;
  isMasterAdmin: boolean;
}

/** Master-only panels need a master admin; umpire mode is open to umpires; the rest need an admin. */
export function canSeePanel(t: TabMeta | undefined, roles: AdminRoles): boolean {
  if (!t) return false;
  if (t.master) return roles.isMasterAdmin;
  return roles.isAdmin || t.id === "umpire";
}

export function visiblePanels(section: SectionMeta | undefined, roles: AdminRoles): TabMeta[] {
  return (section?.panels ?? []).map((p) => PANEL_META.get(p)).filter((t): t is TabMeta => canSeePanel(t, roles));
}

export function sectionOfPanel(id: TabId): SectionMeta | undefined {
  return SECTIONS.find((s) => s.panels.includes(id));
}

/** A section whose every panel is master-only (shown with a shield). */
export function isMasterOnlySection(s: SectionMeta): boolean {
  return s.panels.every((p) => PANEL_META.get(p)?.master);
}
