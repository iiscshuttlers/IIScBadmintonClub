import { PageHeader } from "@/components/ui/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Trophy, Search, Calendar, MapPin, Radio, Clock, CheckCircle2,
  Loader2, SlidersHorizontal, ArrowRight, Sparkles,
  Shield, Award, Users, RefreshCw
} from "lucide-react";
import { getTournaments } from "@/lib/tournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { canonicalFromHubQuery, tournamentLink, tournamentManagePath, tournamentPath } from "@/lib/tournamentRoutes";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { getEventFamily } from "@/lib/tournamentTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTournamentRoles, type MyRole } from "@/hooks/useMyTournamentRoles";
import { useLiveScoresFor } from "@/hooks/useLiveScoresFor";
import { Button } from "@/components/ui/button";
import { TournamentCard } from "@/components/tournament/TournamentCard";
import { TournamentCardSkeleton } from "@/components/tournament/TournamentCardSkeleton";
import { FeaturedTournamentHero } from "@/components/tournament/FeaturedTournamentHero";
import { MyMatchesStrip } from "@/components/tournament/MyMatchesStrip";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { RegisterModal } from "@/components/tournament/RegisterModal";
import { EmptyState } from "@/components/tournament/EmptyState";
import { staggerContainer } from "@/lib/motion";

type StatusFilter = "all" | "upcoming" | "active" | "completed";

/** Finished tournaments: completed, or completed and then archived. */
const isPast = (s: string | null | undefined) => s === "completed" || s === "archived";
type TypeFilter = "all" | "open" | "team";
type RankedFilter = "all" | "ranked" | "casual";
type SortOption = "date_desc" | "date_asc" | "name_asc";

const STATUS_META: Record<string, { label: string; icon: typeof Radio; cls: string }> = {
  active: { label: "Live", icon: Radio, cls: "text-danger bg-danger/10" },
  upcoming: { label: "Upcoming", icon: Clock, cls: "text-primary bg-primary/10" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-success bg-success/10" },
  archived: { label: "Archived", icon: CheckCircle2, cls: "text-muted-foreground bg-muted" },
};

export default function TournamentsHub() {
  usePageMeta({
    title: "Tournaments",
    description: "Browse every IISc Badminton Club tournament — live, upcoming and past.",
  });

  const { session, profile, isAdmin } = useAuth();
  const isAuthed = !!session;
  const { myPlayerId } = useNavigationAuth();

  const [, navigate] = useLocation();
  const locationSearch = useSearch();
  // WP5: the old `/tournaments?id=…` detail view now lives at /tournaments/:id.
  const legacyDetailTarget = canonicalFromHubQuery(locationSearch);
  useEffect(() => {
    if (legacyDetailTarget) navigate(legacyDetailTarget, { replace: true });
  }, [legacyDetailTarget, navigate]);

  // React Query (not local state) so RealtimeProvider's invalidation of
  // ["tournaments"] refreshes the list when a tournament changes status.
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments", "hub"],
    queryFn: getTournaments,
    staleTime: 30_000,
  });
  const all = useMemo<any[]>(
    () => (Array.isArray(tournamentsQuery.data) ? tournamentsQuery.data : []),
    [tournamentsQuery.data],
  );
  const loading = tournamentsQuery.isPending;
  const loadError = tournamentsQuery.isError;
  const load = () => { void tournamentsQuery.refetch(); };

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [ranked, setRanked] = useState<RankedFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");
  const [showFilters, setShowFilters] = useState(false);
  const extraFilterCount = (type !== "all" ? 1 : 0) + (ranked !== "all" ? 1 : 0) + (sortBy !== "date_desc" ? 1 : 0);

  // Registration modal state
  const [registerFor, setRegisterFor] = useState<any | null>(null);

  // Archived = finished and also saved to Legacy. It stays here as a past
  // tournament (Completed); hiding it emptied the hub once every event was
  // archived. Only drafts are hidden.
  const visible = useMemo(() => all.filter((t) => t.status !== "draft"), [all]);

  // My Roles Hook (Phase 0.2 / D)
  const { myRoles, refetch: refetchMyRoles } = useMyTournamentRoles(
    profile?.id || session?.user?.id,
    visible
  );

  // Live match polling hook for in-progress tournaments (Phase 0.3 / F)
  const liveTournamentIds = useMemo(
    () => visible.filter(t => t.status === "active").map(t => t.id),
    [visible]
  );
  const liveScores = useLiveScoresFor(liveTournamentIds);

  // Phase H & W2: Pin Featured Tournament Hero (Live first, else soonest upcoming, else newest)
  const featuredTournament = useMemo(() => {
    if (visible.length === 0) return null;
    const active = visible.find(t => t.status === "active");
    if (active) return active;
    const upcoming = visible
      .filter(t => t.status === "upcoming" && t.startDate)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    if (upcoming.length > 0) return upcoming[0];
    return [...visible].sort((a, b) => {
      const da = new Date(a.startDate || a.created_at || 0).getTime();
      const db = new Date(b.startDate || b.created_at || 0).getTime();
      return db - da;
    })[0];
  }, [visible]);

  // Counts for pills
  const counts = useMemo(() => {
    const c = { all: visible.length, upcoming: 0, active: 0, completed: 0 };
    visible.forEach((t) => {
      if (t.status === "upcoming") c.upcoming++;
      else if (t.status === "active") c.active++;
      else if (isPast(t.status)) c.completed++;
    });
    return c;
  }, [visible]);

  // W2.1: Promote, don't duplicate: when hero is displayed, exclude it from the list
  const listSource = useMemo(() => {
    if (featuredTournament && status === "all" && !search.trim()) {
      return visible.filter(t => t.id !== featuredTournament.id);
    }
    return visible;
  }, [visible, featuredTournament, status, search]);

  // Filtered tournament list
  const filtered = useMemo(() => {
    let list = listSource;
    if (status === "completed") list = list.filter((t) => isPast(t.status));
    else if (status !== "all") list = list.filter((t) => t.status === status);
    if (type !== "all") list = list.filter((t) => t.tournament_type === type);
    if (ranked !== "all") list = list.filter((t) => (ranked === "ranked" ? t.counts_for_elo : !t.counts_for_elo));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        [t.name, t.venue, t.subtitle, (t.categories ?? []).join(" ")]
          .some((v: string) => (v ?? "").toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      const da = new Date(a.startDate || a.created_at || 0).getTime();
      const db = new Date(b.startDate || b.created_at || 0).getTime();
      return sortBy === "date_asc" ? da - db : db - da;
    });
  }, [listSource, status, type, ranked, search, sortBy]);

  // Name collisions detection for disambiguation (Phase P4.4)
  const duplicatedNames = useMemo(() => {
    const counts = new Map<string, number>();
    visible.forEach(t => {
      const nameKey = (t.name || "").trim().toLowerCase();
      if (nameKey) counts.set(nameKey, (counts.get(nameKey) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((cnt, key) => {
      if (cnt > 1) dupes.add(key);
    });
    return dupes;
  }, [visible]);

  // Grouped tournaments (Phase E)
  const grouped = useMemo(() => {
    return {
      active: filtered.filter(t => t.status === "active"),
      upcoming: filtered.filter(t => t.status === "upcoming"),
      completed: filtered.filter(t => isPast(t.status)),
    };
  }, [filtered]);

  // My Tournaments (Phase D): Tournaments where user has a registered entry, organizing, or officiating role
  const myTournaments = useMemo(() => {
    if (!session || myRoles.size === 0) return [];
    return visible.filter(t => myRoles.has(t.id));
  }, [visible, myRoles, session]);

  const openTournament = (t: any) => {
    navigate(tournamentLink(t));
  };

  const handleRegisterClick = (t: any) => {
    if (!isAuthed) {
      navigate("/join");
      return;
    }
    setRegisterFor(t);
  };

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Live", count: counts.active },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  if (legacyDetailTarget) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Opening tournament…</span>
      </div>
    );
  }

  const featuredFamily = getEventFamily(featuredTournament || {});

  return (
    <ThemeScope family={featuredFamily} className="min-h-screen bg-background">
      {/* Page header — same component as every other section page */}
      <PageHeader
        badge="Draws & live scores"
        badgeIcon={<Sparkles className="w-3.5 h-3.5" />}
        title="Tournaments"
        subtitle="Follow live events, register for upcoming draws and look back at past results."
      >
        {/* Organisers: one quiet line (the top bar also has + Host). */}
        <p className="text-xs sm:text-sm text-muted-foreground font-medium -mt-2">
          Organising one?{" "}
          <button
            type="button"
            onClick={() => navigate(isAuthed ? "/host-tournament/new" : "/join")}
            className="font-black text-primary hover:underline underline-offset-2"
          >
            Host a tournament
          </button>
          {isAuthed && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => navigate("/host-tournament")}
                className="font-black text-soft hover:text-primary hover:underline underline-offset-2"
              >
                My tournaments
              </button>
            </>
          )}
        </p>
      </PageHeader>

      <section className="container mx-auto px-4 max-w-5xl -mt-6 relative z-20 pb-16 space-y-6">
        {/* Phase H: Pinned Featured Tournament Hero */}
        {!loading && featuredTournament && status === "all" && !search && (
          <FeaturedTournamentHero
            tournament={featuredTournament}
            liveScore={liveScores.get(featuredTournament.id)}
            onOpen={() => openTournament(featuredTournament)}
          />
        )}

        {/* My Matches — live / upcoming / completed (tournament matches) */}
        {isAuthed && (
          <MyMatchesStrip
            myPlayerId={myPlayerId}
            className="bg-card/60 rounded-3xl border border-border p-5 shadow-lg"
          />
        )}

        {/* Phase D: "My Tournaments" Tray (shown only if logged-in user has active roles or during loading) */}
        {isAuthed && (loading || myTournaments.length > 0) && (
          <div className="bg-gradient-to-r from-individual/10 via-card/60 to-individual/10 rounded-3xl border border-individual/20 p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-individual/20 text-individual">
                  <Award className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  My Tournaments {loading ? "" : `(${myTournaments.length})`}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Quick Access</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3.5 bg-card/90 rounded-2xl border border-border animate-pulse space-y-3">
                    <div className="flex justify-between">
                      <div className="h-3 w-12 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded pt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myTournaments.map((t) => {
                  const role = myRoles.get(t.id);
                  const isOrganizer = role?.isCreator || role?.roles.has("ORGANIZER");
                  const isOfficiating = role?.roles.has("REFEREE") || role?.roles.has("UMPIRE");

                  return (
                    <div
                      key={t.id}
                      className="p-3.5 bg-card/90 rounded-2xl border border-border hover:border-primary/50 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-black uppercase text-primary">
                            {t.tournament_type === "team" ? "Team" : "Individual"}
                          </span>
                          <div className="flex gap-1">
                            {isOrganizer && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-individual/20 text-individual">
                                Organizer
                              </span>
                            )}
                            {isOfficiating && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-info/20 text-info">
                                Official
                              </span>
                            )}
                            {role?.registration && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-success/20 text-success">
                                Player ({role.registration})
                              </span>
                            )}
                          </div>
                        </div>

                        <h4
                          className="font-bold text-sm text-foreground line-clamp-1 cursor-pointer hover:text-primary transition"
                          onClick={() => openTournament(t)}
                        >
                          {t.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs">
                        {isOrganizer ? (
                          <button
                            onClick={() => navigate(tournamentManagePath(t.id, isAdmin))}
                            className="text-[11px] font-bold text-individual hover:underline"
                          >
                            Organizer Console →
                          </button>
                        ) : isOfficiating ? (
                          <button
                            onClick={() => navigate(tournamentPath(t.id, null, { panel: role?.roles.has("REFEREE") ? "referee" : "umpire" }))}
                            className="text-[11px] font-bold text-info hover:underline"
                          >
                            Officiate Matches →
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRegisterClick(t)}
                            className="text-[11px] font-bold text-success hover:underline"
                          >
                            Manage Entry →
                          </button>
                        )}

                        <button
                          onClick={() => openTournament(t)}
                          className="text-[11px] font-bold text-muted-foreground hover:text-primary"
                        >
                          View Hub
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search + Filter Controls */}
        <div className="bg-card/90 backdrop-blur-md rounded-3xl border border-border/80 shadow-xl shadow-media/5 p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments by name, venue or category…"
              className="w-full pl-10 pr-3.5 py-2 bg-background border border-border rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((s) => (
                <Button key={s.key} size="pill" variant={status === s.key ? "pillActive" : "pillMuted"} onClick={() => setStatus(s.key)}>
                  {s.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      status === s.key
                        ? "bg-media/15 text-background"
                        : "bg-muted-strong/80 text-soft"
                    }`}
                  >
                    {s.count}
                  </span>
                </Button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                showFilters || extraFilterCount > 0
                  ? "border-primary/50 text-primary bg-primary/10"
                  : "border-border-strong text-soft hover:border-primary/40"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters{extraFilterCount > 0 ? ` (${extraFilterCount})` : ""}
            </button>
          </div>

          {/* Type, ranked and sort live behind the Filters button */}
          {showFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border/80">
            {([["all", "All types"], ["open", "Individual"], ["team", "Team"]] as [TypeFilter, string][]).map(([k, label]) => (
              <Button key={k} size="pill" variant={type === k ? "pillActive" : "pillMuted"} onClick={() => setType(k)}>
                {label}
              </Button>
            ))}
            <span className="w-px h-5 bg-muted mx-1" />
            {([["all", "Any"], ["ranked", "★ Ranked"], ["casual", "Casual"]] as [RankedFilter, string][]).map(([k, label]) => (
              <Button key={k} size="pill" variant={ranked === k ? "pillActive" : "pillMuted"} onClick={() => setRanked(k)}>
                {label}
              </Button>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
              <span className="font-bold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-muted text-soft rounded-xl px-2.5 py-1 font-bold text-xs outline-none border border-border-strong cursor-pointer"
              >
                <option value="date_desc">Latest Date</option>
                <option value="date_asc">Earliest Date</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>
          )}
        </div>

        {/* Results Area */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TournamentCardSkeleton count={4} />
          </div>
        ) : loadError ? (
          <div className="text-center py-16 bg-card rounded-3xl border border-border shadow-sm">
            <p className="text-sm font-bold text-soft">Couldn't load tournaments.</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:brightness-110 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={visible.length === 0 ? "No tournaments yet" : "No matching tournaments"}
            description={
              visible.length === 0
                ? "Be the first to host an event for the IISc Badminton Club! 🏸"
                : "Try clearing search keywords or active filters to see all events."
            }
            actionLabel={visible.length === 0 ? "Host the first tournament" : undefined}
            onAction={visible.length === 0 ? () => navigate(isAuthed ? "/host-tournament/new" : "/join") : undefined}
          />
        ) : status === "all" ? (
          /* Phase E: Grouped Layout (Live now, Upcoming, Past) with Motion Stagger */
          <div className="space-y-8">
            {/* Live Now Group */}
            {grouped.active.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-live animate-ping" />
                  <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                    Live Now ({grouped.active.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {grouped.active.map((t) => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      disambiguate={duplicatedNames.has((t.name || "").trim().toLowerCase())}
                      myRole={myRoles.get(t.id)}
                      liveScore={liveScores.get(t.id)}
                      isAuthed={isAuthed}
                      onOpen={() => openTournament(t)}
                      onRegister={() => handleRegisterClick(t)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {/* Upcoming Tournaments Group */}
            {grouped.upcoming.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                    Upcoming Tournaments ({grouped.upcoming.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {grouped.upcoming.map((t) => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      disambiguate={duplicatedNames.has((t.name || "").trim().toLowerCase())}
                      myRole={myRoles.get(t.id)}
                      isAuthed={isAuthed}
                      onOpen={() => openTournament(t)}
                      onRegister={() => handleRegisterClick(t)}
                    />
                  ))}
                </motion.div>
              </div>
            )}

            {/* Past Tournaments Group */}
            {grouped.completed.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                    Past Tournaments ({grouped.completed.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {grouped.completed.map((t) => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      disambiguate={duplicatedNames.has((t.name || "").trim().toLowerCase())}
                      myRole={myRoles.get(t.id)}
                      isAuthed={isAuthed}
                      onOpen={() => openTournament(t)}
                    />
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        ) : (
          /* Filtered Flat Grid with Motion Stagger */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {filtered.map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                disambiguate={duplicatedNames.has((t.name || "").trim().toLowerCase())}
                myRole={myRoles.get(t.id)}
                liveScore={liveScores.get(t.id)}
                isAuthed={isAuthed}
                onOpen={() => openTournament(t)}
                onRegister={() => handleRegisterClick(t)}
              />
            ))}
          </motion.div>
        )}
      </section>

      {/* Phase B: Direct Registration Modal */}
      {registerFor && (
        <RegisterModal
          open={!!registerFor}
          onClose={() => setRegisterFor(null)}
          tournament={{
            id: registerFor.id,
            name: registerFor.name,
            categories: registerFor.categories,
            tournament_type: registerFor.tournament_type,
            format_family: registerFor.format_family,
            counts_for_elo: registerFor.counts_for_elo,
          }}
          onRegistered={() => {
            refetchMyRoles();
            load();
          }}
        />
      )}
    </ThemeScope>
  );
}
