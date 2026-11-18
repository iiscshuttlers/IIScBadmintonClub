import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { computeTournamentStatus, winnersFromFinals, type FinalsWinner } from "@/lib/tournaments";
import { isUuid } from "@/lib/tournamentRoutes";

/**
 * Loads exactly one tournament for the canonical route (WP5).
 *
 * Visibility is decided by RLS: a draft the viewer may not read returns no
 * row, which is reported as `not_found` — the same as a non-existent ID — so
 * the route never confirms that a hidden tournament exists. A failed request
 * is reported as `error` and is never substituted with another tournament.
 */
export interface TournamentRouteData {
  /** Raw `tournaments` row, as the existing tournament components expect. */
  tournament: Record<string, any> & { id: string; status: string };
  /** Date-aware lifecycle status (same rule as the tournaments hub). */
  lifecycle: string;
  winners?: FinalsWinner[];
}

export type TournamentRouteState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; retry: () => void }
  | ({ kind: "ready" } & TournamentRouteData);

export async function fetchTournamentForRoute(id: string): Promise<TournamentRouteData | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, tournament_matches(category, match_code, round_name, winner_side, team1_label, team2_label)")
    .eq("id", id)
    .neq("status", "deleted")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { tournament_matches, ...row } = data as Record<string, any>;
  const lifecycle = computeTournamentStatus(row as { status: string; start_date?: string | null; end_date?: string | null });
  const finished = lifecycle === "completed" || lifecycle === "archived";
  return {
    tournament: row as TournamentRouteData["tournament"],
    lifecycle,
    winners: finished ? winnersFromFinals(Array.isArray(tournament_matches) ? tournament_matches : []) : undefined,
  };
}

export function useTournamentRoute(id: string): TournamentRouteState {
  const q = useQuery({
    queryKey: ["tournament-route", id],
    queryFn: () => fetchTournamentForRoute(id),
    retry: 1,
    staleTime: 30_000,
  });

  if (q.isPending) return { kind: "loading" };
  // A failed background refetch keeps showing the last successful result.
  if (q.data === undefined) return { kind: "error", retry: () => void q.refetch() };
  if (q.data === null) return { kind: "not_found" };
  return { kind: "ready", ...q.data };
}
