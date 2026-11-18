import { MyCertificatesCard } from "@/components/tournament/MyCertificatesCard";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { fetchTournaments, fetchUserTournamentRoles } from "@/services/tournamentService";
import { getLiveMatchPicks, saveLiveMatchPick, fetchPollRevealedMatches, updatePollRevealedMatches } from "@/services/feedService";
import {
  Activity,
  Trophy,
  Search,
  ChevronDown,
  Clock,
  UserCheck,
  LayoutList,
  Users,
  Tv2,
  ListChecks,
  FileText,
  Calendar,
  Bell,
  Swords,
  Gavel,
  ClipboardList,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useFeedMatches } from "@/hooks/useFeedMatches";
import { usePlayerMatches } from "@/hooks/usePlayerMatches";
import { useQueryState } from "@/hooks/useQueryState";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { LiveBracketsSection } from "@/components/events/LiveBracketsSection";
import { LiveStandingsSection } from "@/components/events/LiveStandingsSection";
import { LivePlayersSection } from "@/components/events/LivePlayersSection";
import { LiveTeamsSection } from "@/components/events/LiveTeamsSection";
import { MatchCentre } from "@/components/match/MatchCentre";
import { LiveScoreTicker } from "@/components/match/LiveScoreTicker";
import { TournamentStatsTab } from "@/components/match/TournamentStatsTab";
import { ChipStrip } from "@/components/match/ChipStrip";
import { PulseMatchItem } from "@/components/pulse/PulseMatchItem";
import {
  canonicalForLiveSubTab,
  isLiveTabOffered,
  liveSubTabFor,
  type LiveSubTab,
  type TournamentPanel,
  type TournamentTab,
} from "@/lib/tournamentRoutes";
import { PollsSection } from "@/components/feed/PollsSection";
import { LiveMatchSchedule } from "@/components/events/LiveMatchSchedule";
import { TeamStandingsTable } from "@/components/events/TeamStandingsTable";
import { TeamTiesSection } from "@/components/events/TeamTiesSection";
import { TournamentDetailsTab } from "@/components/pulse/TournamentDetailsTab";
import { MatchSection } from "@/components/pulse/MatchSection";
import { LIVE_STATUSES, disciplineOf } from "@/lib/matchView";
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { MatchPredictionCard } from "@/components/feed/MatchPredictions";
import { MatchReminderModal } from "@/components/pulse/MatchReminderModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import { OrganizerDashboard } from "@/components/events/OrganizerDashboard";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { TournamentNextMatch } from "@/components/tournament/TournamentNextMatch";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { RefereeDashboard } from "@/components/tournament/RefereeDashboard";
import { RegisterModal } from "@/components/tournament/RegisterModal";
import { getEventFamily } from "@/lib/tournamentTheme";

/**
 * Canonical tournament page mode (WP5). The tournament is fixed by the route
 * and is never substituted; tab state lives in the URL path, not `?subtab=`.
 */
export interface LiveTabRoute {
  tournament: any;
  /** Date-aware lifecycle status used to decide whether Live is offered. */
  lifecycle: string;
  tab: TournamentTab;
  panel: TournamentPanel | null;
  navigate: (to: { tab: TournamentTab; panel: TournamentPanel | null }) => void;
  /** Rendered between the tab bar and the tab content (e.g. winners on Results). */
  beforeContent?: ReactNode;
}

export interface LiveTabProps {
  embedded?: boolean;
  route?: LiveTabRoute;
}

/** Horizontal row that keeps the current item (aria-current="page") scrolled into view. */
function ScrollRow({ activeKey, className, children, ...rest }: { activeKey: string; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const el = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row && el) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [activeKey]);
  return <div ref={ref} className={`relative ${className ?? ""}`} {...rest}>{children}</div>;
}

/** "12–14 Dec · Gymkhana Courts · Team event · Ranked" — one muted line instead of badges. */
function tournamentFacts(t: any): string {
  const day = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  let dates = "";
  if (t?.start_date) dates = day(t.start_date);
  if (t?.end_date && t.end_date.slice(0, 10) !== t.start_date?.slice(0, 10)) dates = dates ? `${dates} – ${day(t.end_date)}` : day(t.end_date);
  return [
    dates,
    t?.venue,
    t?.format_family === "TEAM" ? "Team event" : null,
    t?.counts_for_elo === false ? "Friendly (not ranked)" : "Ranked",
  ].filter(Boolean).join(" · ");
}

export function LiveTab({ embedded = false, route }: LiveTabProps = {}) {
  const { session, profile: ownProfile, isUmpire, isAdmin } = useAuth();
  const { liveMatchIds, hasLiveMatches } = useLiveMatches();

  const [querySubTab, setQuerySubTab] = useQueryState<LiveSubTab>("subtab", "matches");
  const isRouteTeam = route?.tournament?.format_family === "TEAM";
  const activeSubTab: LiveSubTab = route ? liveSubTabFor(route.tab, route.panel, isRouteTeam) : querySubTab;
  const setActiveSubTab = (sub: LiveSubTab) => {
    if (route) route.navigate(canonicalForLiveSubTab(sub, route.tab));
    else setQuerySubTab(sub);
  };
  const [activeTournament, setActiveTournament] = useState<any | null>(route?.tournament ?? null);
  const [tournaments, setTournaments] = useState<any[]>(route ? [route.tournament] : []);

  // Route mode: keep the routed tournament in sync (e.g. after a refetch).
  useEffect(() => {
    if (!route) return;
    setActiveTournament(route.tournament);
    setTournaments([route.tournament]);
    setTournamentFilter(route.tournament.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.tournament]);

  useEffect(() => {
    if (route) return; // the route owns tournament selection; never fall back
    const searchParams = new URLSearchParams(window.location.search);
    const queryTournamentId = searchParams.get("id") || searchParams.get("tournament_id");

    async function loadTournaments() {
      const data = await fetchTournaments();

      if (data && data.length > 0) {
        setTournaments(data);
        if (queryTournamentId) {
          const match = data.find((t: any) => t.id === queryTournamentId);
          if (match) {
            setActiveTournament(match);
            setTournamentFilter(match.id);
            return;
          }
        }
        // Live shows what's on now (or next). Completed/archived events live on
        // the Tournaments page; falling back to them made Live look stale.
        const current =
          data.find((t: any) => t.status === "active") ||
          data.find((t: any) => t.status === "upcoming");
        if (current) {
          setActiveTournament(current);
          setTournamentFilter(current.id);
        }
      }
    }

    loadTournaments();
  }, []);

  const activeTournamentId = activeTournament?.id;

  const handleSelectTournament = (tId: string) => {
    const selected = tournaments.find((t: any) => t.id === tId);
    if (selected) {
      setActiveTournament(selected);
      setTournamentFilter(tId);
      const url = new URL(window.location.href);
      url.searchParams.set("id", tId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [feedView, setFeedView] = useQueryState<"my" | "tournament">("feed", "tournament", true);

  // Dynamic URL syncing for Tournament Matches — use replace so filters
  // don't create back-button history entries; only the primary subtab does.
  const [queryMatchStatus, setQueryMatchStatus] = useQueryState<"upcoming" | "completed">("m_status", "upcoming", true);
  const matchStatus: "upcoming" | "completed" = route ? (route.tab === "results" ? "completed" : "upcoming") : queryMatchStatus;
  const setMatchStatus = (status: "upcoming" | "completed") => {
    if (route) route.navigate({ tab: status === "completed" ? "results" : "live", panel: null });
    else setQueryMatchStatus(status);
  };
  // Canonical URLs use `cat` (shared with the Players view); Pulse keeps `m_cat`.
  const [matchCat, setMatchCat] = useQueryState<"ALL" | "MS" | "MD" | "XD" | "WS" | "WD">(route ? "cat" : "m_cat", "ALL", true);

  const [isGlobalReminderOpen, setIsGlobalReminderOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // Is the viewer an assigned official (umpire/organiser/referee) for the active tournament?
  const [liveOfficialRoles, setLiveOfficialRoles] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const pid = ownProfile?.id;
    if (!activeTournamentId || !pid) { setLiveOfficialRoles(new Set()); return; }
    (async () => {
      const roles = await fetchUserTournamentRoles(activeTournamentId, pid);
      if (!cancelled) setLiveOfficialRoles(new Set(roles));
    })();
    return () => { cancelled = true; };
  }, [activeTournamentId, ownProfile?.id]);
  const isLiveUmpire = liveOfficialRoles.has("UMPIRE");
  const isLiveOrganizer = liveOfficialRoles.has("ORGANIZER");
  const isLiveReferee = liveOfficialRoles.has("REFEREE");
  const canReferee = isAdmin || isLiveOrganizer || isLiveReferee;

  const initialTournamentId = route
    ? route.tournament.id
    : typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("id") || new URLSearchParams(window.location.search).get("tournament_id") || "all")
      : "all";

  const {
    loading,
    matches,
    displayMatches,
    limitCount,
    setLimitCount,
    courtUtil,
    matchOfTheDayId,
    weeklyRecap,
    timeFilter,
    setTimeFilter,
    tournamentFilter,
    setTournamentFilter,
    searchQuery,
    setSearchQuery
  } = useFeedMatches(ownProfile, 2000, initialTournamentId);

  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && displayMatches.length > 0) {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#match-card-')) {
        setTimeout(() => {
          const elId = hash.substring(1);
          const matchId = elId.replace('match-card-', '');
          setExpandedMatchId(matchId);

          const el = document.getElementById(elId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-950', 'transition-all', 'duration-700');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-950');
            }, 3000);
          }
        }, 500); // Allow time for DOM to paint
      } else if (!expandedMatchId) {
        const liveMatch = displayMatches.find(m => m.status === 'in_progress');
        if (liveMatch) {
          setExpandedMatchId(liveMatch.id);
        } else if (matchOfTheDayId) {
          setExpandedMatchId(matchOfTheDayId);
        }
      }
    }
  }, [loading, displayMatches.length, matchOfTheDayId]);

  const { matches: myAllMatches } = usePlayerMatches(ownProfile?.id);

  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!ownProfile?.id) return;
    const loadPicks = async () => {
      try {
        const myVotes = await getLiveMatchPicks(ownProfile.id);
        setPicks(myVotes);
        const revealed = await fetchPollRevealedMatches();
        setRevealedMatchIds(revealed);
      } catch (err) {
        console.error("Failed to load picks/revealed matches:", err);
      }
    };
    loadPicks();
  }, [ownProfile?.id]);

  const handlePick = async (matchId: string, team: 1 | 2) => {
    if (!ownProfile?.id) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    await saveLiveMatchPick(matchId, ownProfile.id, team);
  };

  const handleToggleReveal = async (matchId: string) => {
    if (!isAdmin) return;
    const isRevealed = !!revealedMatchIds[matchId];
    const nextState = { ...revealedMatchIds, [matchId]: !isRevealed };
    setRevealedMatchIds(nextState);
    await updatePollRevealedMatches(nextState);
  };

  const renderSkeleton = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-3 w-1/3 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );

  if (!activeTournamentId && !hasLiveMatches) {
    return (
      <div className="container mx-auto px-4 max-w-3xl mt-8 pb-10">
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
          <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
            No Live Tournament
          </h3>
          <p className="text-muted-foreground font-medium max-w-sm mx-auto">
            Nothing is being played right now. Past results and upcoming events are on the Tournaments page.
          </p>
          <Link
            href="/tournaments"
            className="mt-5 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-black"
          >
            <Trophy className="w-4 h-4" aria-hidden /> Browse tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ThemeScope family={getEventFamily(activeTournament || {})} className="container mx-auto px-4 max-w-3xl mt-8 pb-10">
      {activeTournament && (
        <div className={`text-center mb-4 ${embedded ? "mt-2" : "mt-0"}`}>
          {!embedded ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <motion.h1
                  layoutId={activeTournament?.id ? `tourn-title-${activeTournament.id}` : undefined}
                  className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white"
                  style={{ fontFamily: "Playfair Display, serif" }}
                >
                  {activeTournament.name}
                </motion.h1>
                {tournaments.length > 1 && (
                  <div className="relative inline-block ml-1">
                    <select
                      value={activeTournament.id}
                      onChange={(e) => handleSelectTournament(e.target.value)}
                      className="appearance-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-full pl-3 pr-7 py-1 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary cursor-pointer shadow-xs"
                      title="Switch Tournament"
                    >
                      {tournaments.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.format_family === "TEAM" ? "Team" : "Open"}{t.status ? `, ${t.status}` : ""})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>
              {activeTournament.subtitle && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">{activeTournament.subtitle}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">{tournamentFacts(activeTournament)}</p>
            </>
          ) : (
            tournaments.length > 1 && (
              <div className="flex justify-center mb-2">
                <div className="relative inline-block">
                  <select
                    value={activeTournament.id}
                    onChange={(e) => handleSelectTournament(e.target.value)}
                    className="appearance-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-full pl-3 pr-7 py-1 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary cursor-pointer shadow-xs"
                    title="Switch Tournament"
                  >
                    {tournaments.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        Switch to: {t.name} ({t.format_family === "TEAM" ? "Team" : "Open"}{t.status ? `, ${t.status}` : ""})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )
          )}
          {activeTournament.require_app_registration && (activeTournament.status === "upcoming" || activeTournament.status === "active") && (
            session ? (
              <button
                onClick={() => setShowRegister(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-black transition shadow-sm"
              >
                <ClipboardList className="w-4 h-4" /> Register for this event
              </button>
            ) : (
              <Link
                href="/join"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-primary/40 text-primary text-sm font-black hover:bg-primary/10 transition"
              >
                <ClipboardList className="w-4 h-4" /> Sign in to register
              </Link>
            )
          )}
        </div>
      )}

      {activeTournament && showRegister && (
        <RegisterModal
          open={showRegister}
          onClose={() => setShowRegister(false)}
          tournament={{
            id: activeTournament.id,
            name: activeTournament.name,
            categories: activeTournament.categories,
            tournament_type: activeTournament.tournament_type,
            format_family: activeTournament.format_family,
            counts_for_elo: activeTournament.counts_for_elo,
          }}
        />
      )}

      {route && activeTournament && session && (
        <TournamentNextMatch tournamentId={activeTournament.id} tournamentName={activeTournament.name} />
      )}

      {/* Score strip on every tab except Live, which already leads with live cards. */}
      {route && activeTournamentId && route.tab !== "live" && <LiveScoreTicker tournamentId={activeTournamentId} />}

      {/* One scrollable row: sections first, then personal views, then staff tools in one menu. */}
      {(() => {
        const canUmpire = isUmpire || isAdmin || isLiveUmpire;
        const canOrganize = isAdmin || isUmpire || isLiveOrganizer || isLiveUmpire || activeTournament?.created_by === session?.user?.id;
        type Item = { key: string; label: string; icon: any; isActive: boolean; onSelect: () => void };
        let sections: Item[];
        let staff: Item[];
        if (route) {
          const go = (to: { tab: any; panel: any }) => () => route.navigate(to);
          const isTabActive = (tab: string) => !route.panel && (route.tab === tab || (tab === "results" && route.tab === "stats"));
          sections = [
            ...(isLiveTabOffered(route.lifecycle, route.tab) ? [{ key: "live", label: "Live", icon: Activity, isActive: isTabActive("live"), onSelect: go({ tab: "live", panel: null }) }] : []),
            { key: "overview", label: "Overview", icon: FileText, isActive: isTabActive("overview"), onSelect: go({ tab: "overview", panel: null }) },
            { key: "players", label: isRouteTeam ? "Teams" : "Players", icon: Users, isActive: isTabActive("players"), onSelect: go({ tab: "players", panel: null }) },
            { key: "draw", label: isRouteTeam ? "Ties & standings" : "Draw", icon: isRouteTeam ? Swords : LayoutList, isActive: isTabActive("draw"), onSelect: go({ tab: "draw", panel: null }) },
            { key: "schedule", label: "Schedule", icon: Calendar, isActive: isTabActive("schedule"), onSelect: go({ tab: "schedule", panel: null }) },
            { key: "results", label: "Results", icon: Trophy, isActive: isTabActive("results"), onSelect: go({ tab: "results", panel: null }) },
            ...(session ? [{ key: "my-matches", label: "My matches", icon: UserCheck, isActive: route.panel === "my-matches", onSelect: go({ tab: route.tab, panel: "my-matches" }) }] : []),
            { key: "polls", label: "Predict", icon: ListChecks, isActive: route.panel === "polls", onSelect: go({ tab: route.tab, panel: "polls" }) },
          ];
          staff = [
            ...(canUmpire ? [{ key: "umpire", label: "Umpire", icon: Tv2, isActive: route.panel === "umpire", onSelect: go({ tab: route.tab, panel: "umpire" }) }] : []),
            ...(canReferee ? [{ key: "referee", label: "Referee", icon: Gavel, isActive: route.panel === "referee", onSelect: go({ tab: route.tab, panel: "referee" }) }] : []),
            ...(canOrganize ? [{ key: "organizer", label: "Organiser", icon: LayoutDashboard, isActive: route.panel === "organizer", onSelect: go({ tab: route.tab, panel: "organizer" }) }] : []),
          ];
        } else {
          const all: Item[] = [
            { id: "details", label: "Details", icon: FileText },
            ...(activeTournament?.format_family === "TEAM" ? [{ id: "ties", label: "Ties & Lineups", icon: Swords }] : []),
            { id: "matches", label: "Matches", icon: Activity },
            { id: "polls", label: "Polls", icon: ListChecks },
            { id: "schedule", label: "Schedule", icon: Calendar },
            { id: "my-matches", label: "My Matches", icon: Activity },
            ...(activeTournament?.format_family === "TEAM" ? [{ id: "standings", label: "Points Table", icon: Trophy }] : []),
            { id: "brackets", label: "Brackets", icon: LayoutList },
            ...((isUmpire || isAdmin || isLiveUmpire) ? [{ id: "umpire", label: "Umpire", icon: Tv2 }] : []),
            ...(canReferee ? [{
              id: "referee",
              label: "Referee",
              icon: Gavel
            }] : []),
            ...((isAdmin || isUmpire || isLiveOrganizer || isLiveUmpire || activeTournament?.created_by === session?.user?.id) ? [{
              id: "organizer",
              label: "Organizer",
              icon: LayoutDashboard
            }] : []),
          ].map((t: any) => ({ ...t, key: t.id, isActive: activeSubTab === t.id, onSelect: () => setActiveSubTab(t.id) }));
          sections = all.filter((t) => !["umpire", "referee", "organizer"].includes(t.key));
          staff = all.filter((t) => ["umpire", "referee", "organizer"].includes(t.key));
        }
        const pill = (active: boolean) =>
          `shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${active
            ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/25"
            : "bg-slate-200 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"}`;
        const activeStaff = staff.find((t) => t.isActive);
        const activeKey = [...sections, ...staff].find((t) => t.isActive)?.key ?? "";
        return (
          <ScrollRow
            activeKey={activeKey}
            role="navigation"
            aria-label="Tournament sections"
            className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto flex-nowrap pt-1 pb-2 mb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((tab) => (
              <button key={tab.key} onClick={tab.onSelect} aria-current={tab.isActive ? "page" : undefined} className={pill(tab.isActive)}>
                <tab.icon className="w-4 h-4 mb-[1px]" aria-hidden />
                <span>{tab.label}</span>
              </button>
            ))}
            {staff.length === 1 && (
              <button onClick={staff[0].onSelect} aria-current={staff[0].isActive ? "page" : undefined} className={pill(staff[0].isActive)}>
                {(() => { const Icon = staff[0].icon; return <Icon className="w-4 h-4 mb-[1px]" aria-hidden />; })()}
                <span>{staff[0].label}</span>
              </button>
            )}
            {staff.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-current={activeStaff ? "page" : undefined} className={pill(!!activeStaff)}>
                    <Settings2 className="w-4 h-4 mb-[1px]" aria-hidden />
                    <span>{activeStaff ? activeStaff.label : "Manage"}</span>
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {staff.map((t) => (
                    <DropdownMenuItem key={t.key} onClick={t.onSelect}>
                      <t.icon /> {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </ScrollRow>
        );
      })()}

      {route?.beforeContent}

      {/* Players / Teams (canonical route only) */}
      {route && activeSubTab === "players" && activeTournament && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-6">
          {isRouteTeam ? (
            <LiveTeamsSection tournamentId={activeTournament.id} showParticipants={activeTournament.show_participants} />
          ) : (
            <LivePlayersSection
              tournamentId={activeTournament.id}
              categories={activeTournament.categories || []}
              showParticipants={activeTournament.show_participants}
            />
          )}
        </div>
      )}

      {/* 0. Details */}
      {!loading && activeSubTab === "details" && (
        <div className="mb-6">
          {activeTournament ? (
            <TournamentDetailsTab tournament={activeTournament} playerName={ownProfile?.full_name || null} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <FileText className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Tournament Details</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No active or selected tournament was found.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sports-site plan item 8: tournament stats, live from finished matches. */}
      {route && route.tab === "stats" && !route.panel && activeTournamentId && (
        <TournamentStatsTab
          tournamentId={activeTournamentId}
          finished={route.lifecycle === "completed" || route.lifecycle === "archived"}
        />
      )}

      {/* WP6: canonical Live / Results tabs use the Match Centre. */}
      {route && activeSubTab === "matches" && activeTournamentId && (
        <>
          {route.tab === "live" && (
            <div className="-mx-4 sm:mx-0 mb-6">
              <LiveScoreSection tournamentId={activeTournamentId} />
            </div>
          )}
          <MatchCentre key={route.tab} tournamentId={activeTournamentId} mode={route.tab === "results" ? "results" : "live"} />
          {route.tab === "results" && !isRouteTeam && (
            <div className="mb-6">
              <CollapsibleSection title="Stats" icon={<BarChart3 />} summary="Leaders, streaks and records from finished matches">
                <TournamentStatsTab
                  tournamentId={activeTournamentId}
                  finished={route.lifecycle === "completed" || route.lifecycle === "archived"}
                />
              </CollapsibleSection>
            </div>
          )}
        </>
      )}

      {/* 1. Matches (Scores & Log merged) and My Matches */}
      {!loading && ((activeSubTab === "matches" && !route) || activeSubTab === "my-matches") && (
        <div className="mb-6">
          {activeSubTab === "matches" && (!route || route.tab === "live") && (
            <div className="-mx-4 sm:mx-0 mb-6">
              <LiveScoreSection />
            </div>
          )}

          {activeSubTab === "matches" && activeTournament?.format_family === "TEAM" && activeTournamentId && (
            <div className="mb-6">
              <TeamTiesSection tournamentId={activeTournamentId} tournament={activeTournament} />
            </div>
          )}

          <div className="mb-3 relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search matches, players, formats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-foreground text-sm font-bold rounded-2xl pl-11 pr-4 py-3 outline-none border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {!route && <div className="flex w-full sm:flex-1 relative">
              <select
                value={tournamentFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setTournamentFilter(val);
                  if (val !== "all") {
                    const match = tournaments.find(t => t.id === val);
                    if (match) {
                      setActiveTournament(match);
                      const url = new URL(window.location.href);
                      url.searchParams.set("id", val);
                      window.history.replaceState({}, "", url.toString());
                    }
                  } else {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("id");
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
                className="appearance-none bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
              >
                <option value="all">All Tournaments</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.format_family === "TEAM" ? "Team" : "Open"}{t.status ? `, ${t.status}` : ""})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>}

            {/* One-tap time range (Match Centre style); disciplines are the chips below. */}
            <div className="w-full sm:w-auto sm:pl-4 sm:border-l sm:border-slate-200 dark:sm:border-slate-700 min-w-0">
              <ChipStrip
                label="Time"
                options={[
                  { value: "all", label: "All time" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This week" },
                  { value: "month", label: "This month" },
                ]}
                value={timeFilter}
                onChange={(v) => setTimeFilter(v as typeof timeFilter)}
              />
            </div>
          </div>

          {loading ? (
            renderSkeleton()
          ) : displayMatches.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                const upcomingMatches: any[] = [];
                const completedMatches: any[] = [];
                let myMatchesList = myAllMatches.filter((m: any) => {
                  const tId = tournamentFilter !== "all" ? tournamentFilter : activeTournamentId;
                  if (tId) {
                    return m.tournament_id === tId;
                  }
                  return true;
                });

                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase().trim();
                  myMatchesList = myMatchesList.filter((m: any) => {
                    const p1Name = m.player1?.full_name?.toLowerCase() || "";
                    const p2Name = m.player2?.full_name?.toLowerCase() || "";
                    const p3Name = m.player3?.full_name?.toLowerCase() || m.partner1?.full_name?.toLowerCase() || "";
                    const p4Name = m.player4?.full_name?.toLowerCase() || m.partner2?.full_name?.toLowerCase() || "";
                    const t1Label = m.team1_label?.toLowerCase() || "";
                    const t2Label = m.team2_label?.toLowerCase() || "";
                    const mId = m.id?.toLowerCase() || "";
                    const mNumber = m.match_number?.toString().toLowerCase() || "";
                    const mFormat = m.format?.toLowerCase() || "";
                    const mCategory = m.category?.toLowerCase() || "";
                    return (p1Name.includes(q) || p2Name.includes(q) || p3Name.includes(q) || p4Name.includes(q) || t1Label.includes(q) || t2Label.includes(q) || mId.includes(q) || mNumber.includes(q) || mFormat.includes(q) || mCategory.includes(q));
                  });
                }

                displayMatches.forEach(match => {
                  const isLiveNow = !match.is_friendly &&
                    (liveMatchIds.has(match.player1_id) || liveMatchIds.has(match.player2_id) ||
                      (match.team1_partner_id && liveMatchIds.has(match.team1_partner_id)) ||
                      (match.team2_partner_id && liveMatchIds.has(match.team2_partner_id)));

                  if (isLiveNow) {
                    // Handled by LiveScoreSection, exclude from here
                  } else if (
                    match.status === 'scheduled' ||
                    match.status === 'pending' ||
                    // Tournament rows: status column decides (a live match is not "completed").
                    (match.is_friendly === false && LIVE_STATUSES.has(String(match.status ?? '').toLowerCase()))
                  ) {
                    upcomingMatches.push(match);
                  } else {
                    completedMatches.push(match);
                  }
                });

                myMatchesList.sort((a, b) => {
                  const getRank = (m: any) => {
                    if (m.status === 'scheduled') return 0;
                    if (m.status === 'in_progress') return 0;
                    if (m.status === 'pending') return 1;
                    return 2;
                  };
                  const rankA = getRank(a);
                  const rankB = getRank(b);
                  if (rankA !== rankB) return rankA - rankB;

                  if (rankA === 0) {
                    if (!a.scheduled_at && !b.scheduled_at) return 0;
                    if (!a.scheduled_at) return 1;
                    if (!b.scheduled_at) return -1;
                    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                  }

                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

                upcomingMatches.sort((a, b) => {
                  if (!a.scheduled_at && !b.scheduled_at) return 0;
                  if (!a.scheduled_at) return 1;
                  if (!b.scheduled_at) return -1;
                  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
                });

                const renderCard = (match: any, i: number) => {
                  const p1 = match.player1;
                  const p2 = match.player2;
                  const isP1Winner = match.winner_id === p1?.id;

                  let upsetDiff = 0;
                  if (
                    match.elo_change_p1 !== undefined &&
                    match.elo_change_p2 !== undefined &&
                    p1 && p2
                  ) {
                    const eloDiff = p1.elo_rating - p2.elo_rating;
                    if (
                      (isP1Winner && eloDiff < -150) ||
                      (!isP1Winner && eloDiff > 150)
                    ) {
                      upsetDiff = Math.abs(eloDiff);
                    }
                  }

                  const isMatchOfTheDay = match.id === matchOfTheDayId;
                  const isLiveNow = !match.is_friendly &&
                    (liveMatchIds.has(match.player1_id) || liveMatchIds.has(match.player2_id) ||
                      (match.team1_partner_id && liveMatchIds.has(match.team1_partner_id)) ||
                      (match.team2_partner_id && liveMatchIds.has(match.team2_partner_id)));

                  return (
                    <ErrorBoundary key={`eb-${match.id}`}>
                      <PulseMatchItem
                        key={match.id}
                        match={match}
                        isMatchOfTheDay={isMatchOfTheDay}
                        upsetDiff={upsetDiff}
                        prediction={
                          match.match_code ? (
                            <MatchPredictionCard
                              compact
                              matchId={match.id}
                              t1Label={match.team1_label ?? "TBD"}
                              t2Label={match.team2_label ?? "TBD"}
                              hasStarted={isLiveNow || match.status === 'completed' || match.status === 'walkover'}
                              myPick={picks[match.id]}
                              profileId={ownProfile?.id}
                              onPick={(team) => handlePick(match.id, team)}
                              // Revealed once play starts (the poll's own rule), so finished matches too.
                              isResultsRevealed={isLiveNow || match.status === 'completed' || match.status === 'walkover' || !!revealedMatchIds[match.id]}
                              isAdmin={isAdmin}
                              // Finished matches always show results, so there is nothing to toggle.
                              onToggleRevealResults={match.status === 'completed' || match.status === 'walkover' ? undefined : () => handleToggleReveal(match.id)}
                            />
                          ) : null
                        }
                      />
                    </ErrorBoundary>
                  );
                };

                return (
                  <>
                    {activeSubTab === "my-matches" ? (
                      <>
                        <MyCertificatesCard tournament={activeTournament} />
                        <MatchSection
                          title="My Matches"
                          icon={<Activity className="w-5 h-5 text-violet-500" />}
                          matches={myMatchesList}
                          defaultExpanded={true}
                          renderMatchCard={renderCard}
                          headerAction={
                            <button
                              onClick={() => setIsGlobalReminderOpen(true)}
                              className="p-1.5 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:hover:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded-full transition-colors"
                              title="Global Match Reminders"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                          }
                        />
                        {session?.user?.id && (
                          <MatchReminderModal
                            isOpen={isGlobalReminderOpen}
                            onClose={() => setIsGlobalReminderOpen(false)}
                            userId={session.user.id}
                            initialGlobalMins={ownProfile?.default_match_reminder_mins}
                          />
                        )}
                      </>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300 mb-6">
                        <div className="flex border-b border-slate-100 dark:border-slate-800">
                          {(["upcoming", "completed"] as const).map(status => (
                            <button
                              key={status}
                              onClick={() => setMatchStatus(status)}
                              className={`flex-1 py-4 text-sm font-black capitalize transition-colors ${matchStatus === status
                                ? "text-primary border-b-2 border-primary bg-slate-50/50 dark:bg-slate-800/50"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                                }`}
                            >
                              {status}
                              <span className="ml-2 text-xs text-muted-foreground opacity-70">
                                ({status === "upcoming" ? upcomingMatches.length : completedMatches.length})
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="p-4 sm:p-5">
                          <div className="mb-5">
                            <ChipStrip
                              label="Discipline"
                              options={(["ALL", "MS", "WS", "MD", "WD", "XD"] as const).map((c) => ({ value: c, label: c === "ALL" ? "All" : c }))}
                              value={matchCat}
                              onChange={(v) => setMatchCat(v as typeof matchCat)}
                            />
                          </div>
                          <div className="space-y-4">
                            {(() => {
                              const list = matchStatus === "upcoming" ? upcomingMatches : completedMatches;
                              // One discipline rule everywhere (category text or match-code prefix).
                              const filteredList = list.filter(m => matchCat === "ALL" || disciplineOf(m.category, m.match_code) === matchCat);

                              if (filteredList.length === 0) return <div className="text-center py-12 text-sm font-bold text-slate-400">No matches found in this section.</div>;
                              return filteredList.map((m, i) => renderCard(m, i));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {matches.length >= limitCount && (
                <div className="flex justify-center mt-6 pt-4 pb-8">
                  <button
                    onClick={() => setLimitCount((prev) => prev + 50)}
                    className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 rounded-full font-bold text-sm transition shadow-sm hover:shadow-md"
                  >
                    Load More Matches
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8 p-6">
              <div className="w-20 h-20 mx-auto bg-slate-50 dark:bg-slate-800/80 rounded-3xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                {activeTournament?.format_family === "TEAM" ? (
                  <Swords className="w-9 h-9 text-primary" />
                ) : (
                  <Trophy className="w-9 h-9 text-slate-300 dark:text-muted-foreground" />
                )}
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
                {activeTournament?.format_family === "TEAM"
                  ? "Team Tournament Fixtures"
                  : "No matches yet"}
              </h3>
              <p className="text-muted-foreground font-medium max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
                {activeTournament?.format_family === "TEAM"
                  ? "In team tournaments, fixtures and rubbers are organized as team ties. Head-to-head ties, line-ups, and scores are tracked under the Ties & Lineups tab."
                  : timeFilter !== "all"
                    ? "No matches found for this time filter. Switch time filter to 'All Time' or view the Schedule tab to see unscheduled matches."
                    : "No matches found matching your filters. Unscheduled bracket matches will appear once assigned or when filtering by All Time."}
              </p>
              {activeTournament?.format_family === "TEAM" && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("ties")}
                    className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Swords className="w-4 h-4" /> Switch to Ties &amp; Lineups
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeSubTab === "schedule" && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="font-black text-lg mb-4 text-slate-800 dark:text-foreground">Match Schedule</h2>
          {activeTournamentId ? (
            <LiveMatchSchedule tournamentId={activeTournamentId} playerName={ownProfile?.full_name || null} />
          ) : (
            <div className="text-center py-10 text-slate-400">
              <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-sm">No tournament schedule available.</p>
            </div>
          )}
        </div>
      )}

      {/* 3. Polls */}
      {!loading && activeSubTab === "polls" && (
        <div className="mb-6">
          <PollsSection tournamentId={activeTournamentId} />
        </div>
      )}

      {/* 4. Brackets */}
      {!loading && activeSubTab === "brackets" && (
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          {activeTournamentId ? (
            <LiveBracketsSection tournamentId={activeTournamentId} showBrackets={true} />
          ) : (
            <div className="text-center py-10 text-slate-400">
              <LayoutList className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-sm">No brackets available.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Points Table / Standings */}
      {!loading && activeSubTab === "standings" && (
        <div className="mb-6">
          {activeTournament && activeTournament.format_family !== "TEAM" ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/50">
                <Trophy className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">
                Points Table Not Available
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Points tables and league standings are only available for <strong>Team Tournaments</strong>.
                {activeTournament?.name ? ` "${activeTournament.name}"` : " This event"} is an individual (open event) tournament where players advance via knockout brackets.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={() => setActiveSubTab("brackets")}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-full shadow-sm hover:opacity-90 transition"
                >
                  View Draw & Brackets
                </button>
                <button
                  onClick={() => setActiveSubTab("matches")}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  View Matches
                </button>
              </div>
            </div>
          ) : activeTournamentId ? (
            <TeamStandingsTable tournamentId={activeTournamentId} tournament={activeTournament} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Standings Available</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No active team tournament is selected.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 6. Team Ties & Lineups */}
      {!loading && activeSubTab === "ties" && (
        <div className="mb-6">
          {route && activeTournamentId && (
            <div className="mb-6">
              <TeamStandingsTable tournamentId={activeTournamentId} tournament={activeTournament} />
            </div>
          )}
          {activeTournamentId ? (
            <TeamTiesSection tournamentId={activeTournamentId} tournament={activeTournament} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <Swords className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Team Tournament Selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Select an active team tournament to view fixtures, playing orders, and lineups.
              </p>
            </div>
          )}
        </div>
      )}

      {(isUmpire || isAdmin || isLiveUmpire) && activeSubTab === "umpire" && (
        <div className="mb-6">
          <UmpireTab tournamentId={activeTournament?.id} tournament={activeTournament} />
        </div>
      )}

      {canReferee && activeSubTab === "referee" && (
        <div className="mb-6">
          {activeTournamentId ? (
            <RefereeDashboard tournament={activeTournament} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <Gavel className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Tournament Selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Select an active tournament to oversee its matches.
              </p>
            </div>
          )}
        </div>
      )}

      {(isAdmin || isUmpire || isLiveOrganizer || isLiveUmpire || activeTournament?.created_by === session?.user?.id) && activeSubTab === "organizer" && (
        <div className="mb-6">
          {activeTournamentId ? (
            <OrganizerDashboard
              tournamentId={activeTournamentId}
              tournament={activeTournament}
            />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <LayoutDashboard className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Tournament Selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Select an active tournament to view the Organizer command dashboard.
              </p>
            </div>
          )}
        </div>
      )}



    </ThemeScope>
  );
}
