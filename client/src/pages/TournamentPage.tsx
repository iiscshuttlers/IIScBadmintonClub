import { useEffect, useMemo } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { ArrowLeft, Loader2, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { LiveTab } from "@/components/pulse/LiveTab";
import { TournamentWinnersPanel } from "@/components/tournament/TournamentWinnersPanel";
import { TournamentStoryPanel } from "@/components/tournament/TournamentStoryPanel";
import { FollowTournamentButton } from "@/components/tournament/FollowTournamentButton";
import { useTournamentRoute } from "@/hooks/queries/useTournamentRoute";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { getArchivedTournament } from "@/data/tournamentArchive";
import {
  defaultTabForStatus,
  isUuid,
  parseTournamentTab,
  parseTournamentRouteFilters,
  tournamentPath,
  type TournamentPanel,
  type TournamentTab,
} from "@/lib/tournamentRoutes";

/** Shared full-page states for the canonical tournament and match routes. */
export function RouteStatusCard({
  kind,
  title,
  message,
  onRetry,
}: {
  kind: "loading" | "not_found" | "error";
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  const Icon = kind === "error" ? WifiOff : SearchX;
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div
        className="max-w-md w-full text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-8"
        role={kind === "error" ? "alert" : undefined}
      >
        <Icon className="w-10 h-10 mx-auto mb-3 text-slate-400" aria-hidden />
        <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">
          {title ?? (kind === "error" ? "Couldn't load this tournament" : "Tournament not found")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {message ??
            (kind === "error"
              ? "Check your connection and try again. Nothing on this page has been changed."
              : "This tournament doesn't exist or isn't visible to you.")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-black"
            >
              <RefreshCw className="w-4 h-4" aria-hidden /> Retry
            </button>
          )}
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold"
          >
            All tournaments
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Canonical tournament page (WP5): `/tournaments/:id[/:tab]`.
 * One URL for the tournament's whole lifecycle; see
 * docs/decisions/wp5-canonical-routes.md.
 */
export default function TournamentPage() {
  const [, params] = useRoute<{ id: string; tab?: string }>("/tournaments/:id/:tab?");
  const [, navigate] = useLocation();
  const search = useSearch();
  const id = params?.id ?? "";
  const rawTab = params?.tab;
  const filters = useMemo(() => parseTournamentRouteFilters(search), [search]);
  const panel = filters.panel ?? null;

  const state = useTournamentRoute(id);

  usePageMeta({
    title: state.kind === "ready" ? state.tournament.name : "Tournament",
    description:
      state.kind === "ready"
        ? state.tournament.description || `${state.tournament.name} — draw, schedule and results.`
        : "Tournament draw, schedule and results.",
  });

  // Non-UUID ids are legacy archive slugs; their canonical home stays /events/:slug.
  const legacySlug = id && !isUuid(id) ? id : null;
  // An unknown tab segment is dropped rather than shown as an error.
  const badTab = rawTab != null && parseTournamentTab(rawTab) == null;

  useEffect(() => {
    if (legacySlug) navigate(`/events/${encodeURIComponent(legacySlug)}${search ? `?${search}` : ""}`, { replace: true });
    else if (badTab) navigate(tournamentPath(id, null, filters), { replace: true });
  }, [legacySlug, badTab, id, filters, search, navigate]);

  if (legacySlug || badTab || state.kind === "loading") return <RouteStatusCard kind="loading" />;
  if (state.kind === "not_found") return <RouteStatusCard kind="not_found" />;
  if (state.kind === "error") return <RouteStatusCard kind="error" onRetry={state.retry} />;

  const { tournament, lifecycle, winners } = state;
  const tab: TournamentTab = parseTournamentTab(rawTab) ?? defaultTabForStatus(lifecycle);
  const finished = lifecycle === "completed" || lifecycle === "archived";

  const go = (to: { tab: TournamentTab; panel: TournamentPanel | null }) => {
    // Tab changes push history (Back walks tabs); route-owned filters are kept.
    navigate(tournamentPath(id, to.tab, { ...filters, panel: to.panel }));
  };

  const showWinners = finished && tab === "results" && !panel;
  const showStory = tab === "results" && !panel;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
      <div className="container mx-auto px-4 max-w-3xl pt-5 flex items-center justify-between gap-4">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-1.5 text-sm font-black text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> All tournaments
        </Link>
        <FollowTournamentButton tournamentId={id} tournamentName={tournament.name} />
      </div>
      <LiveTab
        route={{
          tournament,
          lifecycle,
          tab,
          panel,
          navigate: go,
          beforeContent:
            showWinners || showStory ? (
              <>
                {showWinners && (
                  <FinishedWinners id={id} name={tournament.name} startDate={tournament.start_date} derived={winners} />
                )}
                {showStory && <TournamentStoryPanel tournamentId={id} tournamentName={tournament.name} />}
              </>
            ) : undefined,
        }}
      />
    </div>
  );
}

/**
 * Winners for a finished tournament. Prefers the archive record (which adds
 * bronze/fourth places and team podiums) and falls back to decided finals.
 * Kept in its own component so archive data is only fetched on Results.
 */
function FinishedWinners({
  id,
  name,
  startDate,
  derived,
}: {
  id: string;
  name: string;
  startDate?: string | null;
  derived?: Array<{ category: string; winner: string; runnerUp?: string }>;
}) {
  const { archivedTournaments } = useArchivedTournaments();
  const record = getArchivedTournament(id, archivedTournaments);
  const input = {
    id,
    name,
    startDate: startDate ?? undefined,
    winners: record?.winners ?? derived,
    podium: record?.podium,
  };
  if (!input.winners?.length && !input.podium?.length) return null;
  return (
    <section
      aria-labelledby="tournament-winners-heading"
      className="mb-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 sm:p-6 space-y-6"
    >
      <h2 id="tournament-winners-heading" className="text-lg font-black text-slate-800 dark:text-slate-100">
        Winners
      </h2>
      <TournamentWinnersPanel tournament={input} />
    </section>
  );
}
