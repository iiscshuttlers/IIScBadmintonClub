import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Clock, Trophy, Loader2, SlidersHorizontal, Plus, RefreshCw, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { getTournaments } from "@/lib/tournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { canonicalFromHubQuery, tournamentLink } from "@/lib/tournamentRoutes";
import {
  DEFAULT_HUB_FILTERS,
  countByStatus,
  duplicateNames,
  filterTournaments,
  groupByStatus,
  hasActiveFilters,
  pickFeaturedTournament,
  type HubFilters,
  type HubRankedFilter,
  type HubSort,
  type HubStatusFilter,
  type HubTypeFilter,
} from "@/lib/tournamentHub";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { getEventFamily } from "@/lib/tournamentTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTournamentRoles } from "@/hooks/useMyTournamentRoles";
import { useLiveScoresFor } from "@/hooks/useLiveScoresFor";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { TournamentCard } from "@/components/tournament/TournamentCard";
import { TournamentCardSkeleton } from "@/components/tournament/TournamentCardSkeleton";
import { FeaturedTournamentHero } from "@/components/tournament/FeaturedTournamentHero";
import { YourTournaments } from "@/components/tournament/YourTournaments";
import { RegisterModal } from "@/components/tournament/RegisterModal";
import { EmptyState } from "@/components/tournament/EmptyState";
import { staggerContainer } from "@/lib/motion";

/** Below this many tournaments the list is short enough to scan: no search bar. */
const TOOLBAR_MIN_TOURNAMENTS = 7;

const TYPE_OPTIONS: [HubTypeFilter, string][] = [["all", "All types"], ["open", "Individual"], ["team", "Team"]];
const RANKED_OPTIONS: [HubRankedFilter, string][] = [["all", "Any"], ["ranked", "★ Ranked"], ["casual", "Casual"]];
const SORT_OPTIONS: [HubSort, string][] = [["date_desc", "Latest date"], ["date_asc", "Earliest date"], ["name_asc", "Name (A–Z)"]];

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
  const hasData = Array.isArray(tournamentsQuery.data);
  const loading = tournamentsQuery.isPending;
  // A failed refresh keeps showing the cached list; only an empty page shows the error.
  const loadError = tournamentsQuery.isError && !hasData;

  // Archived = finished and also saved to Legacy; it stays here with the
  // results. Only drafts are hidden.
  const visible = useMemo<any[]>(
    () => (hasData ? (tournamentsQuery.data as any[]) : []).filter((t) => t.status !== "draft"),
    [hasData, tournamentsQuery.data],
  );

  const [filters, setFilters] = useState<HubFilters>(DEFAULT_HUB_FILTERS);
  const setFilter = (patch: Partial<HubFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const [showFilters, setShowFilters] = useState(false);
  const [registerFor, setRegisterFor] = useState<any | null>(null);

  const { myRoles, refetch: refetchMyRoles } = useMyTournamentRoles(profile?.id || session?.user?.id, visible, profile?.id);
  const liveIds = useMemo(() => visible.filter((t) => t.status === "active").map((t) => t.id), [visible]);
  const liveScores = useLiveScoresFor(liveIds);

  // The hero shows the live (or next) tournament and is left out of the list
  // below. Any filter hides it, so a filtered list is always complete.
  const filtering = hasActiveFilters(filters);
  const featured = useMemo(() => pickFeaturedTournament(visible), [visible]);
  const hero = filtering ? null : featured;
  const counts = useMemo(() => countByStatus(visible), [visible]);
  const filtered = useMemo(
    () => filterTournaments(hero ? visible.filter((t) => t.id !== hero.id) : visible, filters),
    [visible, hero, filters],
  );
  const groups = useMemo(() => groupByStatus(filtered), [filtered]);
  const dupes = useMemo(() => duplicateNames(visible), [visible]);

  const showToolbar = visible.length >= TOOLBAR_MIN_TOURNAMENTS || filtering;
  const filterCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.ranked !== "all" ? 1 : 0) +
    (filters.sort !== DEFAULT_HUB_FILTERS.sort ? 1 : 0);
  const clearFilters = () => setFilters(DEFAULT_HUB_FILTERS);

  const handleRegisterClick = (t: any) => {
    if (!isAuthed) {
      navigate("/join");
      return;
    }
    setRegisterFor(t);
  };

  const renderCard = (t: any) => (
    <TournamentCard
      key={t.id}
      t={t}
      href={tournamentLink(t)}
      disambiguate={dupes.has((t.name || "").trim().toLowerCase())}
      myRole={myRoles.get(t.id)}
      liveScore={liveScores.get(t.id)}
      onRegister={() => handleRegisterClick(t)}
    />
  );

  if (legacyDetailTarget) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Opening tournament…</span>
      </div>
    );
  }

  const statusOptions: [HubStatusFilter, string, number][] = [
    ["all", "All", counts.all],
    ["active", "Live", counts.active],
    ["upcoming", "Upcoming", counts.upcoming],
    ["completed", "Completed", counts.completed],
  ];

  return (
    <ThemeScope family={getEventFamily(hero || {})} className="min-h-screen bg-background">
      <PageHeader
        align="left"
        compact
        title="Tournaments"
        subtitle="Live scores, upcoming draws and past results."
        action={
          <>
            {isAuthed && (
              <Button asChild size="sm" variant="outline" className="border-border-strong">
                <Link href="/host-tournament">My tournaments</Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={isAuthed ? "/host-tournament/new" : "/join"}>
                <Plus aria-hidden="true" /> Host a tournament
              </Link>
            </Button>
          </>
        }
      />

      <section className="container mx-auto px-4 max-w-5xl pb-16 space-y-6">
        {hero && (
          <FeaturedTournamentHero
            tournament={hero}
            href={tournamentLink(hero)}
            liveScore={liveScores.get(hero.id)}
            myRole={myRoles.get(hero.id)}
            onRegister={() => handleRegisterClick(hero)}
          />
        )}

        {/* Answer "is anything on?" even when the answer is no. */}
        {!loading && !featured && visible.length > 0 && !filtering && (
          <p className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-dashed border-border-strong text-sm text-muted-foreground">
            <CalendarClock className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Nothing is live or scheduled right now.
              <span className="hidden sm:inline"> Results from past tournaments are below.</span>
            </span>
          </p>
        )}

        {isAuthed && (
          <YourTournaments
            myPlayerId={myPlayerId}
            tournaments={visible}
            myRoles={myRoles}
            isAdmin={isAdmin}
            onManageEntry={handleRegisterClick}
          />
        )}

        {showToolbar && (
          <div className="bg-card/90 rounded-3xl border border-border p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Search tournaments</span>
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilter({ search: e.target.value })}
                  placeholder="Search tournaments…"
                  className="w-full pl-10 pr-3.5 py-2 bg-background border border-border rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="hub-filters"
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition ${
                  showFilters || filterCount > 0
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-border-strong text-soft hover:border-primary/40"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Filters{filterCount > 0 ? ` (${filterCount})` : ""}
              </button>
            </div>

            {showFilters && (
              <div id="hub-filters" className="pt-3 border-t border-border/80 space-y-2.5">
                <FilterRow label="Status">
                  {statusOptions.map(([key, label, count]) => (
                    <Button
                      key={key}
                      size="pill"
                      variant={filters.status === key ? "pillActive" : "pillMuted"}
                      aria-pressed={filters.status === key}
                      onClick={() => setFilter({ status: key })}
                    >
                      {label}
                      <span className="tabular-nums opacity-75">{count}</span>
                    </Button>
                  ))}
                </FilterRow>
                <FilterRow label="Type">
                  {TYPE_OPTIONS.map(([key, label]) => (
                    <Button
                      key={key}
                      size="pill"
                      variant={filters.type === key ? "pillActive" : "pillMuted"}
                      aria-pressed={filters.type === key}
                      onClick={() => setFilter({ type: key })}
                    >
                      {label}
                    </Button>
                  ))}
                </FilterRow>
                <FilterRow label="Elo">
                  {RANKED_OPTIONS.map(([key, label]) => (
                    <Button
                      key={key}
                      size="pill"
                      variant={filters.ranked === key ? "pillActive" : "pillMuted"}
                      aria-pressed={filters.ranked === key}
                      onClick={() => setFilter({ ranked: key })}
                    >
                      {label}
                    </Button>
                  ))}
                </FilterRow>
                <FilterRow label="Sort">
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilter({ sort: e.target.value as HubSort })}
                    aria-label="Sort tournaments"
                    className="bg-muted text-soft rounded-xl px-2.5 py-1.5 font-bold text-xs outline-none border border-border-strong cursor-pointer"
                  >
                    {SORT_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  {filterCount > 0 && (
                    <button type="button" onClick={clearFilters} className="ml-auto text-xs font-bold text-primary hover:underline">
                      Clear filters
                    </button>
                  )}
                </FilterRow>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <TournamentCardSkeleton count={3} />
          </div>
        ) : loadError ? (
          <div className="text-center py-16 bg-card rounded-3xl border border-border shadow-sm">
            <p className="text-sm font-bold text-soft">Couldn't load tournaments.</p>
            <button
              type="button"
              onClick={() => void tournamentsQuery.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:brightness-110 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No tournaments yet"
            description="Be the first to host an event for the IISc Badminton Club! 🏸"
            actionLabel="Host the first tournament"
            onAction={() => navigate(isAuthed ? "/host-tournament/new" : "/join")}
          />
        ) : filtered.length === 0 ? (
          // Without filters an empty list just means the hero holds the only tournament.
          filtering ? (
            <EmptyState
              title="No matching tournaments"
              description="Try another search, or clear the filters to see every event."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : null
        ) : (
          <div className="space-y-8">
            <TournamentGroup
              title={hero?.status === "active" ? "Also live" : "Live now"}
              icon={<span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse" />}
              items={groups.active}
              renderCard={renderCard}
            />
            <TournamentGroup
              title={hero?.status === "upcoming" ? "More upcoming" : "Upcoming"}
              icon={<Clock className="w-4 h-4 text-primary" />}
              items={groups.upcoming}
              renderCard={renderCard}
            />
            <TournamentGroup
              title="Results"
              icon={<Trophy className="w-4 h-4 text-gold" />}
              items={groups.past}
              renderCard={renderCard}
            />
          </div>
        )}
      </section>

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
            void tournamentsQuery.refetch();
          }}
        />
      )}
    </ThemeScope>
  );
}

/** One labelled row of filter controls. */
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="w-12 shrink-0 text-[11px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex flex-1 items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

/** A titled group of tournament cards (Live now, Upcoming, Results). */
function TournamentGroup({
  title,
  icon,
  items,
  renderCard,
}: {
  title: string;
  icon: ReactNode;
  items: any[];
  renderCard: (t: any) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-black text-foreground uppercase tracking-wider">
        <span aria-hidden="true" className="inline-flex">{icon}</span>
        {title}
        <span className="text-muted-foreground tabular-nums">({items.length})</span>
      </h2>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {items.map(renderCard)}
      </motion.div>
    </section>
  );
}
