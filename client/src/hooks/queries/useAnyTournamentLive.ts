import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { LIVE_STATUSES } from "@/lib/matchView";
import { tournamentPath } from "@/lib/tournamentRoutes";

/**
 * Is any tournament match live right now? (Cricbuzz-style global live marker.)
 *
 * Tournament matches only: unlike `useLiveMatches` (site_data.live_matches),
 * this never counts friendlies or umpire setup screens. The key starts with
 * "tournament_matches", so RealtimeProvider's invalidation keeps it current
 * without another channel or polling.
 */

export interface AnyTournamentLive {
  /** Number of live tournament matches (capped by the query limit). */
  count: number;
  /** Distinct tournaments with a live match, in first-seen order. Plain array (persisted cache). */
  tournamentIds: string[];
}

export const ANY_LIVE_KEY = ["tournament_matches", "any-live"] as const;

export function summariseLive(rows: Array<{ tournament_id: string | null }>): AnyTournamentLive {
  const ids: string[] = [];
  for (const r of rows) if (r.tournament_id && !ids.includes(r.tournament_id)) ids.push(r.tournament_id);
  return { count: rows.length, tournamentIds: ids };
}

/** Where the marker leads: the one live tournament's Live tab, else the tournaments list. */
export function liveHref(live: AnyTournamentLive): string {
  return live.tournamentIds.length === 1 ? tournamentPath(live.tournamentIds[0], "live") : "/tournaments";
}

export function useAnyTournamentLive(): AnyTournamentLive {
  const q = useQuery({
    queryKey: ANY_LIVE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, tournament_id")
        .in("status", Array.from(LIVE_STATUSES))
        .limit(50);
      if (error) throw error;
      return summariseLive((data ?? []) as Array<{ tournament_id: string | null }>);
    },
    staleTime: 30_000,
    retry: 1,
  });
  return q.data ?? { count: 0, tournamentIds: [] };
}
