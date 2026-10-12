import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy, Search, Calendar, MapPin, Radio, Clock, CheckCircle2,
  Loader2, SlidersHorizontal, ArrowRight, Sparkles, ArrowLeft,
  PlusCircle, FolderKanban, Shield, Award, Users, RefreshCw
} from "lucide-react";
import { getTournaments } from "@/lib/tournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { LiveTab } from "@/components/pulse/LiveTab";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { getEventFamily } from "@/lib/tournamentTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTournamentRoles, type MyRole } from "@/hooks/useMyTournamentRoles";
import { useLiveScoresFor } from "@/hooks/useLiveScoresFor";
import { TournamentCard } from "@/components/tournament/TournamentCard";
import { TournamentCardSkeleton } from "@/components/tournament/TournamentCardSkeleton";
import { FeaturedTournamentHero } from "@/components/tournament/FeaturedTournamentHero";
import { RegisterModal } from "@/components/tournament/RegisterModal";
import { EmptyState } from "@/components/tournament/EmptyState";
import { staggerContainer } from "@/lib/motion";

type StatusFilter = "all" | "upcoming" | "active" | "completed";
type TypeFilter = "all" | "open" | "team";
type RankedFilter = "all" | "ranked" | "casual";
type SortOption = "date_desc" | "date_asc" | "name_asc";

const STATUS_META: Record<string, { label: string; icon: typeof Radio; cls: string }> = {
  active: { label: "Live", icon: Radio, cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/30" },
  upcoming: { label: "Upcoming", icon: Clock, cls: "text-primary bg-primary/10" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  archived: { label: "Archived", icon: CheckCircle2, cls: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
};

export default function TournamentsHub() {
  usePageMeta({
    title: "Tournaments",
    description: "Browse every IISc Badminton Club tournament — live, upcoming and past.",
  });

  const { session, profile } = useAuth();
  const isAuthed = !!session;

  const [, navigate] = useLocation();
  const locationSearch = useSearch();
  const selectedId = new URLSearchParams(locationSearch).get("id") ?? "";

  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [ranked, setRanked] = useState<RankedFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  // Registration modal state
  const [registerFor, setRegisterFor] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTournaments();
      setAll(Array.isArray(data) ? data : []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => all.filter((t) => t.status !== "draft" && t.status !== "archived"),
    [all],
  );

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
      else if (t.status === "completed") c.completed++;
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
    if (status !== "all") list = list.filter((t) => t.status === status);
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
      completed: filtered.filter(t => t.status === "completed"),
    };
  }, [filtered]);

  // My Tournaments (Phase D): Tournaments where user has a registered entry, organizing, or officiating role
  const myTournaments = useMemo(() => {
    if (!session || myRoles.size === 0) return [];
    return visible.filter(t => myRoles.has(t.id));
  }, [visible, myRoles, session]);

  const openTournament = (t: any) => {
    if (t.status === "completed" || t.status === "archived") navigate(`/events/${t.slug}`);
    else navigate(`/tournaments?id=${t.id}`);
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

  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
      active
        ? "bg-primary text-slate-950 shadow-xs"
        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
    }`;

  // Detail view: a tournament is selected (?id=…)
  if (selectedId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
        <div className="container mx-auto px-4 max-w-3xl pt-5">
          <button
            onClick={() => navigate("/tournaments")}
            className="inline-flex items-center gap-1.5 text-sm font-black text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All tournaments
          </button>
        </div>
        <LiveTab embedded={true} />
      </div>
    );
  }

  const featuredFamily = getEventFamily(featuredTournament || {});

  return (
    <ThemeScope family={featuredFamily} className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Banner Hero */}
      <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white py-12 relative overflow-hidden border-b border-slate-800">
        <div 
          className="absolute inset-0 pointer-events-none transition-colors duration-700"
          style={{
            background: "radial-gradient(ellipse 80% 80% at 50% -20%, var(--family-glow, rgba(120,119,198,0.25)), rgba(255,255,255,0))"
          }}
        />
        <div className="container mx-auto px-4 max-w-5xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Tournaments &amp; Events
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-2.5 tracking-tight text-white"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Tournaments Central
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base font-medium mb-6">
            Discover live championships, register for upcoming draws, or organize your own tournament.
          </p>

          {/* Phase C: Host & Manage CTAs in Header */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate(isAuthed ? "/host-tournament/new" : "/join")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-slate-950 font-black text-xs sm:text-sm hover:bg-primary/90 transition shadow-lg hover:scale-105"
            >
              <PlusCircle className="w-4 h-4" /> Host a tournament
            </button>
            {isAuthed && (
              <button
                onClick={() => navigate("/host-tournament")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 transition backdrop-blur-md"
              >
                <FolderKanban className="w-4 h-4" /> My hosted tournaments
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-5xl -mt-6 relative z-20 pb-16 space-y-6">
        {/* Phase H: Pinned Featured Tournament Hero */}
        {!loading && featuredTournament && status === "all" && !search && (
          <FeaturedTournamentHero
            tournament={featuredTournament}
            liveScore={liveScores.get(featuredTournament.id)}
            onOpen={() => openTournament(featuredTournament)}
          />
        )}

        {/* Phase D: "My Tournaments" Tray (shown only if logged-in user has active roles or during loading) */}
        {isAuthed && (loading || myTournaments.length > 0) && (
          <div className="bg-gradient-to-r from-purple-950/20 via-slate-900/60 to-purple-950/20 rounded-3xl border border-purple-900/30 p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400">
                  <Award className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  My Tournaments {loading ? "" : `(${myTournaments.length})`}
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Quick Access</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3.5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
                    <div className="flex justify-between">
                      <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-800 rounded pt-2" />
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
                      className="p-3.5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-black uppercase text-primary">
                            {t.tournament_type === "team" ? "Team" : "Individual"}
                          </span>
                          <div className="flex gap-1">
                            {isOrganizer && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                                Organizer
                              </span>
                            )}
                            {isOfficiating && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                Official
                              </span>
                            )}
                            {role?.registration && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                Player ({role.registration})
                              </span>
                            )}
                          </div>
                        </div>

                        <h4
                          className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 cursor-pointer hover:text-primary transition"
                          onClick={() => openTournament(t)}
                        >
                          {t.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        {isOrganizer ? (
                          <button
                            onClick={() => navigate(`/tournament-admin?id=${t.id}`)}
                            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            Organizer Console →
                          </button>
                        ) : isOfficiating ? (
                          <button
                            onClick={() => navigate(`/tournaments?id=${t.id}&subtab=${role?.roles.has("REFEREE") ? "referee" : "umpire"}`)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Officiate Matches →
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRegisterClick(t)}
                            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Manage Entry →
                          </button>
                        )}

                        <button
                          onClick={() => openTournament(t)}
                          className="text-[11px] font-bold text-slate-500 hover:text-primary"
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
        <div className="bg-white dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-950/5 p-4 sm:p-5 space-y-3.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments by name, venue or category…"
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status pills */}
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((s) => (
                <button key={s.key} onClick={() => setStatus(s.key)} className={pill(status === s.key)}>
                  {s.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      status === s.key
                        ? "bg-black/15 text-slate-950 dark:text-slate-950"
                        : "bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {s.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-bold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-2.5 py-1 font-bold text-xs outline-none border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <option value="date_desc">Latest Date</option>
                <option value="date_asc">Earliest Date</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Type and Ranked filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            </span>
            {([["all", "All types"], ["open", "Individual"], ["team", "Team"]] as [TypeFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setType(k)} className={pill(type === k)}>
                {label}
              </button>
            ))}
            <span className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />
            {([["all", "Any"], ["ranked", "★ Ranked"], ["casual", "Casual"]] as [RankedFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setRanked(k)} className={pill(ranked === k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <TournamentCardSkeleton count={4} />
          </div>
        ) : loadError ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load tournaments.</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-slate-950 text-xs font-black hover:brightness-110 transition shadow-sm"
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
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Live Now ({grouped.active.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid sm:grid-cols-2 gap-4"
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
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Upcoming Tournaments ({grouped.upcoming.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid sm:grid-cols-2 gap-4"
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
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Past Tournaments ({grouped.completed.length})
                  </h3>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid sm:grid-cols-2 gap-4"
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
            className="grid sm:grid-cols-2 gap-4"
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
