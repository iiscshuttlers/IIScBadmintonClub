import { useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useTournamentRoute } from "@/hooks/queries/useTournamentRoute";
import { RouteStatusCard } from "@/pages/TournamentPage";
import { isUuid, matchPath, parseMatchTab, type MatchTab } from "@/lib/tournamentRoutes";
import { fetchVisibleTournamentIdForMatch } from "@/lib/matchRouteVisibility";
import { tournamentReturnRoute } from "@/lib/routeContinuity";

import { DISCIPLINE_LABELS, MATCH_VIEW_COLUMNS, buildSeedIndex, toMatchView, type MatchRow, type MatchView } from "@/lib/matchView";
import { MatchSideRow, MatchStatusBadge, scoreSummary } from "@/components/match/MatchPrimitives";
import { ScrollTabs } from "@/components/ui/ScrollTabs";
import { MatchSummaryTab } from "@/components/match/MatchSummaryTab";
import { MatchH2HTab } from "@/components/match/MatchH2HTab";
import { MatchInfoTab } from "@/components/match/MatchInfoTab";
import { MatchPointsTab } from "@/components/match/MatchPointsTab";
import { useMatchPointLog } from "@/hooks/queries/useMatchPointLog";

interface RouteMatchData {
  match: MatchRow & {
    umpired_by?: string | null;
    scored_by?: string | null;
    points_to_win?: number | null;
    golden_point?: number | null;
    best_of_sets?: number | null;
  };
  seeds: Array<{ category: string | null; player_id: string | null; partner_id: string | null; seed: number | null }>;
  next: { id: string; round_name: string; category: string } | null;
}

async function fetchMatchForRoute(tournamentId: string, matchId: string): Promise<RouteMatchData | null> {
  if (!isUuid(tournamentId) || !isUuid(matchId)) return null;
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`${MATCH_VIEW_COLUMNS}, umpired_by, scored_by, golden_point, best_of_sets`)
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const match = data as unknown as RouteMatchData["match"];

  const [nextRes, seedRes] = await Promise.all([
    match.advances_to_match
      ? supabase
          .from("tournament_matches")
          .select("id, round_name, category")
          .eq("tournament_id", tournamentId)
          .eq("match_code", match.advances_to_match)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("tournament_participants")
      .select("category, player_id, partner_id, seed")
      .eq("tournament_id", tournamentId)
      .not("seed", "is", null),
  ]);
  return {
    match,
    seeds: (seedRes.data ?? []) as RouteMatchData["seeds"],
    next: (nextRes.data as RouteMatchData["next"]) ?? null,
  };
}

const TAB_LABELS: Record<MatchTab, string> = {
  summary: "Summary",
  points: "Points",
  h2h: "H2H & form",
  info: "Info",
};

/**
 * Stable match detail page (WP5 route, WP6 shared presentation), with
 * Cricbuzz/FotMob-style sub-tabs: `/tournaments/:tid/matches/:mid/:mtab?`.
 * No tab (or an unknown one) is Summary, so older links keep working.
 */
export default function TournamentMatchPage() {
  const [, params] = useRoute<{ id: string; matchId: string; mtab?: string }>("/tournaments/:id/matches/:matchId/:mtab?");
  const tournamentId = params?.id ?? "";
  const matchId = params?.matchId ?? "";
  const requestedTab = parseMatchTab(params?.mtab);

  // The parent tournament is loaded first so a match of a hidden draft is
  // reported as not found even if match rows were readable.
  const tState = useTournamentRoute(tournamentId);
  const mQuery = useQuery({
    // "tournament_matches" prefix: refreshed by RealtimeProvider on change.
    queryKey: ["tournament_matches", tournamentId, "match-route", matchId],
    queryFn: () => fetchMatchForRoute(tournamentId, matchId),
    enabled: tState.kind === "ready",
    retry: 1,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const pointLog = useMatchPointLog(tournamentId, matchId, tState.kind === "ready");
  const view: MatchView | null = mQuery.data ? toMatchView(mQuery.data.match, buildSeedIndex(mQuery.data.seeds)) : null;
  usePageMeta({
    title: view ? `${view.sides[0].label} vs ${view.sides[1].label}` : "Match",
    description: view ? `${view.categoryLabel} · ${view.roundName}` : "Tournament match",
  });

  if (tState.kind === "loading") return <RouteStatusCard kind="loading" />;
  if (tState.kind === "not_found") return <RouteStatusCard kind="not_found" title="Match not found" message="This match doesn't exist or isn't visible to you." />;
  if (tState.kind === "error") return <RouteStatusCard kind="error" title="Couldn't load this match" onRetry={tState.retry} />;
  if (mQuery.isPending) return <RouteStatusCard kind="loading" />;
  if (mQuery.data === undefined)
    return <RouteStatusCard kind="error" title="Couldn't load this match" onRetry={() => void mQuery.refetch()} />;
  if (mQuery.data === null || !view)
    return <RouteStatusCard kind="not_found" title="Match not found" message="This match doesn't exist or isn't part of this tournament." />;

  const { next, match } = mQuery.data;
  const t = tState.tournament;
  const summary = scoreSummary(view);
  const lastUpdated = mQuery.dataUpdatedAt ? new Date(mQuery.dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null;

  // Points appears only once a stored point log exists (Phase C); never an empty tab.
  const hasPoints = !!pointLog.data && pointLog.data.pointCount > 0;
  const tabs: MatchTab[] = hasPoints ? ["summary", "points", "h2h", "info"] : ["summary", "h2h", "info"];
  const tab: MatchTab = tabs.includes(requestedTab) ? requestedTab : "summary";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
      <div className="container mx-auto px-4 max-w-2xl pt-5 space-y-4">
        <Link
          href={tournamentReturnRoute(t.id)}
          className="inline-flex items-center gap-1.5 text-sm font-black text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden /> {t.name}
        </Link>

        <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <span>{view.discipline ? `${view.discipline} · ${DISCIPLINE_LABELS[view.discipline]}` : view.categoryLabel}</span>
            {view.roundName && <span>· {view.roundName}</span>}
            {view.rubberLabel && <span>· {view.rubberLabel}</span>}
            <span className="ml-auto normal-case tracking-normal">
              <MatchStatusBadge view={view} />
            </span>
          </div>

          <h1 className="sr-only">
            {view.sides[0].label} versus {view.sides[1].label}
          </h1>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-base">
            <MatchSideRow side={view.sides[0]} index={0} view={view} />
            <MatchSideRow side={view.sides[1]} index={1} view={view} />
          </div>
          {summary && <p className="sr-only">Score: {summary}</p>}
          {view.scoreText && <p className="mt-2 font-mono text-sm tabular-nums">{view.scoreText}</p>}

          <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
            {mQuery.isError
              ? "Couldn't refresh. Showing the last result confirmed by the server."
              : lastUpdated
                ? `Confirmed by server at ${lastUpdated}.`
                : null}
          </p>
        </article>

        <ScrollTabs
          label="Match sections"
          activeKey={tab}
          tabs={tabs.map((k) => ({ key: k, label: TAB_LABELS[k], href: matchPath(t.id, view.id, k) }))}
        />

        <section
          aria-label={TAB_LABELS[tab]}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 sm:p-6"
        >
          {tab === "summary" && <MatchSummaryTab view={view} tournamentName={t.name} next={next} />}
          {tab === "points" && pointLog.data && (
            <MatchPointsTab
              view={view}
              log={pointLog.data}
              rules={{
                pointsToWin: match.points_to_win ?? 21,
                goldenPoint: match.golden_point ?? 30,
                bestOf: match.best_of_sets ?? 3,
              }}
            />
          )}
          {tab === "h2h" && <MatchH2HTab view={view} />}
          {tab === "info" && (
            <MatchInfoTab
              view={view}
              tournament={{ id: t.id, name: t.name }}
              next={next}
              officials={{ umpiredBy: match.umpired_by ?? null, scoredBy: match.scored_by ?? null }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** `/matches/:matchId` → canonical match URL. */
export function MatchShortRedirect() {
  const [, params] = useRoute<{ matchId: string }>("/matches/:matchId");
  const [, navigate] = useLocation();
  const matchId = params?.matchId ?? "";
  const q = useQuery({
    queryKey: ["match-short-route", matchId],
    queryFn: () => fetchVisibleTournamentIdForMatch(matchId),
    retry: 1,
  });

  useEffect(() => {
    if (q.data) navigate(matchPath(q.data, matchId), { replace: true });
  }, [q.data, matchId, navigate]);

  if (q.isPending || q.data) return <RouteStatusCard kind="loading" />;
  if (q.data === undefined) return <RouteStatusCard kind="error" title="Couldn't load this match" onRetry={() => void q.refetch()} />;
  return <RouteStatusCard kind="not_found" title="Match not found" message="This match doesn't exist or isn't visible to you." />;
}
