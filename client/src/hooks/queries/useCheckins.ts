import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MATCH_VIEW_COLUMNS } from "@/lib/matchView";
import {
  buildReadinessBoard,
  buildReadinessContext,
  courtBoard,
  freeCourts,
  type CheckinRow,
  type CourtCallRow,
  type ReadinessMatch,
} from "@/lib/matchReadiness";

/**
 * Player check-in data (migration 20261120160000).
 *
 * Every query returns plain arrays: the react-query cache is persisted to
 * sessionStorage, so a Set/Map would come back as `{}`. Maps are built in
 * memory by lib/matchReadiness.
 *
 * Keys: ["tournament_checkins", tid], ["court_calls", tid] and
 * ["match_presence", tid] are refreshed by RealtimeProvider; match rows sit
 * under "tournament_matches" like every other match query.
 */

export const CHECKIN_COLUMNS =
  "tournament_id, player_id, state, checked_in_at, break_until, break_started_at, here_since, checked_in_by, expires_at";

export interface CheckinTournament {
  id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  min_rest_minutes: number | null;
}

export type ReadinessMatchRow = ReadinessMatch & { tournament_id: string; umpired_by?: string | null };

/** A clock that ticks, so expiry, breaks and rest update without a refetch. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useTournamentCheckins(tournamentId: string | null | undefined, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["tournament_checkins", tournamentId],
    enabled: !!tournamentId && !!session && enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CheckinRow[]> => {
      const { data, error } = await supabase
        .from("tournament_checkins")
        .select(CHECKIN_COLUMNS)
        .eq("tournament_id", tournamentId!);
      if (error) throw error;
      return (data ?? []) as CheckinRow[];
    },
  });
}

/** Court calls of a tournament's matches from the last day (signed-in only). */
export function useCourtCalls(tournamentId: string | null | undefined, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["court_calls", tournamentId],
    enabled: !!tournamentId && !!session && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<CourtCallRow[]> => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("court_calls")
        .select("id, match_id, called_at, called_by, player_ids, tournament_matches!inner(tournament_id)")
        .eq("tournament_matches.tournament_id", tournamentId!)
        .gte("called_at", since)
        .order("called_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<CourtCallRow & { tournament_matches?: unknown }>).map(
        ({ tournament_matches: _tm, ...row }) => row,
      );
    },
  });
}

/** Every match of the tournament (finished ones give rest times) plus its rest rule. */
export function useReadinessMatches(tournamentId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["tournament_matches", tournamentId, "readiness"],
    enabled: !!tournamentId && enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ matches: ReadinessMatchRow[]; tournament: CheckinTournament | null }> => {
      const [m, t] = await Promise.all([
        supabase.from("tournament_matches").select(`${MATCH_VIEW_COLUMNS}, umpired_by`).eq("tournament_id", tournamentId!),
        supabase
          .from("tournaments")
          .select("id, status, start_date, end_date, min_rest_minutes")
          .eq("id", tournamentId!)
          .maybeSingle(),
      ]);
      if (m.error) throw m.error;
      return {
        matches: (m.data ?? []) as unknown as ReadinessMatchRow[],
        tournament: (t.data ?? null) as CheckinTournament | null,
      };
    },
  });
}

/** Display names for player ids. */
export function usePlayerNames(ids: string[]) {
  const key = useMemo(() => Array.from(new Set(ids.filter(Boolean))).sort(), [ids]);
  const q = useQuery({
    queryKey: ["players", "names", key.join(",")],
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Array<{ id: string; full_name: string | null }>> => {
      const out: Array<{ id: string; full_name: string | null }> = [];
      for (let i = 0; i < key.length; i += 150) {
        const { data, error } = await supabase.from("players").select("id, full_name").in("id", key.slice(i, i + 150));
        if (error) throw error;
        out.push(...((data ?? []) as Array<{ id: string; full_name: string | null }>));
      }
      return out;
    },
  });
  return useMemo(() => {
    const names: Record<string, string> = {};
    for (const p of Array.isArray(q.data) ? q.data : []) if (p.full_name) names[p.id] = p.full_name;
    return names;
  }, [q.data]);
}

/**
 * Everything an official surface needs: readiness board, courts, calls and
 * names, from one set of queries. Signed-in only.
 */
export function useTournamentReadiness(tournamentId: string | null | undefined, enabled = true) {
  const now = useNow();
  const matchesQ = useReadinessMatches(tournamentId, enabled);
  const checkinsQ = useTournamentCheckins(tournamentId, enabled);
  const callsQ = useCourtCalls(tournamentId, enabled);
  const matches = useMemo(() => matchesQ.data?.matches ?? [], [matchesQ.data]);
  const checkins = useMemo(() => (Array.isArray(checkinsQ.data) ? checkinsQ.data : []), [checkinsQ.data]);
  const calls = useMemo(() => (Array.isArray(callsQ.data) ? callsQ.data : []), [callsQ.data]);
  const minRest = matchesQ.data?.tournament?.min_rest_minutes ?? null;

  const ctx = useMemo(
    () => buildReadinessContext(matches, checkins, { now, minRestMinutes: minRest }),
    [matches, checkins, now, minRest],
  );
  const board = useMemo(() => buildReadinessBoard(ctx), [ctx]);
  const courts = useMemo(() => courtBoard(matches, calls, now), [matches, calls, now]);
  const free = useMemo(() => freeCourts(courts), [courts]);
  const playerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of matches) for (const p of [m.player1_id, m.player2_id, m.player3_id, m.player4_id]) if (p) ids.add(p);
    return Array.from(ids);
  }, [matches]);
  const names = usePlayerNames(playerIds);

  return {
    now,
    ctx,
    board,
    courts,
    free,
    calls,
    names,
    matches,
    checkins,
    tournament: matchesQ.data?.tournament ?? null,
    loading: matchesQ.isPending || (checkinsQ.isPending && checkinsQ.fetchStatus !== "idle"),
    error: matchesQ.isError || checkinsQ.isError,
    /** False when check-ins can't be read (e.g. the migration isn't applied yet): hide check-in UI. */
    checkinsAvailable: !checkinsQ.isError && checkinsQ.isSuccess,
    refetch: () => {
      void matchesQ.refetch();
      void checkinsQ.refetch();
      void callsQ.refetch();
    },
  };
}

export type TournamentReadiness = ReturnType<typeof useTournamentReadiness>;

/**
 * Spectator chip: match id → both sides here. Works signed out: the
 * tournament_match_presence() function returns only ids and a flag.
 */
export function useMatchPresence(tournamentId: string | null | undefined, enabled = true) {
  const q = useQuery({
    queryKey: ["match_presence", tournamentId],
    enabled: !!tournamentId && enabled,
    staleTime: 20_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Array<{ match_id: string; ready: boolean }>> => {
      const { data, error } = await supabase.rpc("tournament_match_presence", { p_tournament_id: tournamentId! });
      // Before the migration is applied the function doesn't exist: show no chips.
      if (error) return [];
      return (Array.isArray(data) ? data : []) as Array<{ match_id: string; ready: boolean }>;
    },
  });
  return useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const r of Array.isArray(q.data) ? q.data : []) out[r.match_id] = !!r.ready;
    return out;
  }, [q.data]);
}

export type CheckinAction = "check_in" | "break" | "back" | "renew" | "check_out";

const ACTION_DONE: Record<CheckinAction, string> = {
  check_in: "Checked in",
  break: "Enjoy your break",
  back: "Welcome back",
  renew: "You're still checked in",
  check_out: "Checked out",
};

/** Check in / break / back / renew / check out, for yourself or (officials) someone else. */
export function useCheckinAction(tournamentId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { playerId: string; action: CheckinAction; minutes?: number | null; silent?: boolean; label?: string }) => {
      const { data, error } = await supabase.rpc("tournament_checkin", {
        p_tournament_id: tournamentId!,
        p_player_id: vars.playerId,
        p_action: vars.action,
        p_break_minutes: vars.minutes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["tournament_checkins", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["match_presence", tournamentId] });
      if (!vars.silent) toast.success(vars.label ?? ACTION_DONE[vars.action]);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      toast.error(
        /row-level security|permission/i.test(msg)
          ? "You can't change this check-in"
          : msg || "Couldn't update the check-in",
      );
    },
  });
}

/** Call players to court through the call-to-court function; returns its JSON. */
export async function callPlayers(matchId: string, playerIds?: string[]): Promise<{ notified?: number; called?: string[]; on_court?: string[] }> {
  const { data, error } = await supabase.functions.invoke("call-to-court", {
    body: playerIds ? { match_id: matchId, player_ids: playerIds } : { match_id: matchId },
  });
  if (error) {
    let detail = "";
    try {
      detail = (await (error as any)?.context?.json?.())?.error ?? "";
    } catch {
      /* not JSON */
    }
    throw new Error(detail || error.message || "Couldn't call the players");
  }
  return (data ?? {}) as { notified?: number; called?: string[]; on_court?: string[] };
}
