import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { fetchHomeRailMatches } from "@/services/matchService";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAuth } from "@/hooks/useNavigationAuth";
import { subscriptionService } from "@/services/subscriptionService";
import { toMatchView, type MatchRow } from "@/lib/matchView";
import { buildHomeRail, buildMyTournamentSummary, RECENT_MS } from "@/lib/homeRail";
import { MatchScorecard } from "@/components/match/MatchPrimitives";
import { MyTournamentCard } from "@/components/home/MyTournamentCard";

/**
 * "Your matches first" (FotMob favourites): my live/next match, then followed
 * players' and tournaments' live and upcoming matches, then results from the
 * last 48 hours. Signed-in users only; tournament matches only.
 */

interface RailData {
  rows: MatchRow[];
  tournamentNames: Record<string, string>;
  followedPlayers: Record<string, string>;
  followedTournaments: string[];
  /** A follow source failed; show partial data with a notice. */
  partial: boolean;
}

export async function fetchRail(userId: string, myId: string | null): Promise<RailData> {
  const [ps, ts] = await Promise.allSettled([
    subscriptionService.fetchPlayerSubscriptions(userId),
    subscriptionService.fetchTournamentSubscriptions(userId),
  ]);
  const followedPlayers: Record<string, string> = {};
  if (ps.status === "fulfilled") for (const s of ps.value) if (!s.is_muted) followedPlayers[s.player_id] = s.players?.full_name ?? "a player";
  const followedTournaments = ts.status === "fulfilled" ? ts.value.filter((s) => !s.is_muted).map((s) => s.tournament_id) : [];

  const ids = Array.from(new Set([myId, ...Object.keys(followedPlayers)].filter((x): x is string => !!x)));
  const clauses: string[] = [];
  if (ids.length) {
    const list = ids.join(",");
    clauses.push(`player1_id.in.(${list})`, `player2_id.in.(${list})`, `player3_id.in.(${list})`, `player4_id.in.(${list})`);
  }
  if (followedTournaments.length) clauses.push(`tournament_id.in.(${followedTournaments.join(",")})`);
  if (clauses.length === 0) return { rows: [], tournamentNames: {}, followedPlayers, followedTournaments, partial: ps.status === "rejected" || ts.status === "rejected" };

  const since = new Date(Date.now() - RECENT_MS).toISOString();
  const data = await fetchHomeRailMatches(clauses.join(","), since);
  const rows = (data ?? []) as unknown as Array<MatchRow & { tournaments?: { name?: string | null } | null }>;
  const tournamentNames: Record<string, string> = {};
  for (const row of rows) {
    const name = row.tournaments?.name;
    if (name) tournamentNames[row.tournament_id] = name;
  }
  return {
    rows,
    tournamentNames,
    followedPlayers,
    followedTournaments,
    partial: ps.status === "rejected" || ts.status === "rejected",
  };
}

export function HomeMatchRail() {
  const { session } = useAuth();
  const { myPlayerId } = useNavigationAuth();
  const userId = session?.user?.id ?? null;

  const q = useQuery({
    queryKey: ["tournament_matches", "home-rail", userId, myPlayerId ?? null],
    enabled: !!userId,
    queryFn: () => fetchRail(userId!, myPlayerId ?? null),
    staleTime: 30_000,
    retry: 1,
  });

  const views = useMemo(() => q.data?.rows.map((r) => toMatchView(r)) ?? [], [q.data]);
  const myTournament = useMemo(() => buildMyTournamentSummary(views, myPlayerId ?? null), [views, myPlayerId]);
  const rail = useMemo(() => {
    if (!q.data) return [];
    return buildHomeRail(views, {
      myId: myPlayerId ?? null,
      followedPlayers: q.data.followedPlayers,
      followedTournaments: q.data.followedTournaments,
      now: Date.now(),
    }).filter((item) => item.reason !== "my-live" && item.reason !== "my-next");
  }, [q.data, views, myPlayerId]);

  if (!userId || q.isPending) return null;
  if (q.isError) {
    return myPlayerId ? (
      <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <span>Couldn’t load your tournament matches.</span>
        <button type="button" onClick={() => void q.refetch()} className="min-h-[44px] px-3 font-black underline underline-offset-2">Try again</button>
      </div>
    ) : null;
  }
  const follows = Object.keys(q.data.followedPlayers).length + q.data.followedTournaments.length;

  if (!myTournament && rail.length === 0) {
    if (follows > 0) return null; // following people, nothing on right now
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3">
        <p className="text-sm text-slate-700 dark:text-slate-200">Follow players to see their tournament matches here first.</p>
        <Link
          href="/pulse#directory"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full bg-primary text-primary-foreground text-xs font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UserPlus className="w-4 h-4" aria-hidden /> Find players
        </Link>
      </div>
    );
  }

  return (
    <>
      {myTournament && myPlayerId && (
        <MyTournamentCard summary={myTournament} myPlayerId={myPlayerId} tournamentNames={q.data.tournamentNames} />
      )}
      {rail.length > 0 && <section aria-labelledby="home-rail-heading" className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <h2 id="home-rail-heading" className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Following & recent
        </h2>
        {myPlayerId && (
          <Link href={`/player/${myPlayerId}/personal`} className="min-h-[44px] inline-flex items-center text-xs font-black text-primary underline underline-offset-2">
            See all
          </Link>
        )}
      </div>
      {q.data.partial && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">Some follows couldn't be loaded; showing what we have.</p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {rail.map((item) => (
          <li key={item.view.id}>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1 px-1">{item.label}</p>
            <MatchScorecard view={item.view} />
          </li>
        ))}
      </ul>
      </section>}
    </>
  );
}
