/**
 * tournament_matches reads: per-tournament lists, single-match lookups,
 * court/schedule windows, referee, order-of-play, umpire and player match
 * lists, and match counts.
 */
import { supabase } from "@/lib/supabase";
import type { TournamentMatch } from "@/types/tournament";
import { MATCH_VIEW_COLUMNS } from "@/lib/matchView";

export async function fetchTournamentMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("match_number");

  if (error) throw error;
  return (data ?? []) as TournamentMatch[];
}

/**
 * Bracket feeders: the matches whose winner advances into `matchCode`, in
 * match order. Returns null on error (callers treat that as "no feeders").
 */
export async function fetchFeederMatches(tournamentId: string, matchCode: string) {
  const { data } = await supabase
    .from("tournament_matches")
    .select("id, round_name, team1_label, team2_label")
    .eq("tournament_id", tournamentId)
    .eq("advances_to_match", matchCode)
    .order("match_number", { ascending: true });
  return data;
}

/** Tournament matches scheduled within [fromIso, toIso], any tournament. Returns null on error. */
export async function fetchTournamentMatchesScheduledBetween(fromIso: string, toIso: string) {
  const { data } = await supabase
    .from("tournament_matches")
    .select("id, category, round_name, match_code, court_number, status, scheduled_at, score, winner_id, winner_side, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label")
    .gte("scheduled_at", fromIso)
    .lte("scheduled_at", toIso);
  return data;
}

/** Up to 20 tournament matches that are not completed, by round (camera match picker). Returns null on error. */
export async function fetchUncompletedTournamentMatches() {
  const { data } = await supabase
    .from("tournament_matches")
    .select("*")
    .neq("status", "completed")
    .order("round", { ascending: true })
    .limit(20);
  return data;
}

/** One tournament_matches row by id, or null (missing row or error). */
export async function fetchTournamentMatchRow(id: string) {
  const { data } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

/**
 * Every match of a tournament by round and match number, as `{ data, error }`
 * for callers that branch on the error (fetchTournamentMatches throws instead).
 */
export async function fetchTournamentMatchesResult(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("match_number");
  return { data, error };
}

/** A tournament's matches as MATCH_VIEW_COLUMNS rows by round and match number, as `{ data, error }`. */
export async function fetchTournamentMatchViewRows(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(MATCH_VIEW_COLUMNS)
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("match_number");
  return { data, error };
}

/** Every tournament_matches row of a tournament, unordered. Throws on error. */
export async function fetchAllTournamentMatchRows(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data || [];
}

/** Every tournament_matches row of a tournament by match number. Throws on error. */
export async function fetchTournamentMatchesByNumber(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("match_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * The match page row (MATCH_VIEW_COLUMNS plus officiating and scoring fields)
 * when the match belongs to `tournamentId`; null when it is missing. Throws on error.
 */
export async function fetchTournamentMatchForRoute(tournamentId: string, matchId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`${MATCH_VIEW_COLUMNS}, umpired_by, scored_by, golden_point, best_of_sets`)
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** id, round_name and category of the tournament's match with `matchCode`, or null (missing row or error). */
export async function fetchTournamentMatchByCode(tournamentId: string, matchCode: string) {
  const { data } = await supabase
    .from("tournament_matches")
    .select("id, round_name, category")
    .eq("tournament_id", tournamentId)
    .eq("match_code", matchCode)
    .maybeSingle();
  return data;
}

/** Every completed match (any tournament) with its tournament name. Returns null on error. */
export async function fetchCompletedTournamentMatchesWithNames() {
  const { data } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name)")
    .eq("status", "completed");
  return data;
}

/**
 * Matches with a court, scheduled within [fromIso, toIso] (any tournament),
 * with their tournament (id, name, tournament_type). Returns null on error.
 */
export async function fetchCourtMatchesBetween(fromIso: string, toIso: string) {
  const { data } = await supabase
    .from("tournament_matches")
    .select(`
            id,
            tournament_id,
            match_code,
            category,
            court_number,
            scheduled_at,
            status,
            team1_label,
            team2_label,
            tournaments (
              id,
              name,
              tournament_type
            )
          `)
    .gte("scheduled_at", fromIso)
    .lte("scheduled_at", toIso)
    .not("court_number", "is", null);
  return data;
}

/** Referee dashboard match list by round and match number, as `{ data, error }`. */
export async function fetchRefereeMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, player2_id, court_number, scheduled_at, status, score, winner_side, reminder_sent")
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  return { data, error };
}

/** Order-of-play match list by round and match number, as `{ data, error }`. */
export async function fetchOrderOfPlayMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, court_number, scheduled_at, started_at, ended_at, status, tie_id")
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  return { data, error };
}

/**
 * Order-of-play court check: the tournament's pending, scheduled, live and
 * completed matches with their timing and players, as `{ data, error }`.
 */
export async function fetchCourtCheckMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("id, match_code, court_number, scheduled_at, started_at, ended_at, status, tie_id, player1_id, player2_id, player3_id, player4_id")
    .eq("tournament_id", tournamentId)
    .in("status", ["pending", "scheduled", "in_progress", "completed"]);
  return { data, error };
}

/** Umpire tab: scheduled, in-progress and pending matches of the given tournaments, as `{ data, error }`. */
export async function fetchUmpireOpenMatches(tournamentIds: string[]) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .in("tournament_id", tournamentIds)
    .in("status", ["scheduled", "in_progress", "pending"])
    .order("round")
    .order("match_number");
  return { data, error };
}

/** Umpire tab: the 50 most recently scored completed or walkover matches of the given tournaments, as `{ data, error }`. */
export async function fetchUmpireDoneMatches(tournamentIds: string[]) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .in("tournament_id", tournamentIds)
    .in("status", ["completed", "walkover"])
    .order("scored_at", { ascending: false })
    .limit(50);
  return { data, error };
}

export async function countTournamentMatches(
  tournamentId: string,
  category?: string,
): Promise<number> {
  let query = supabase
    .from("tournament_matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (category) {
    query = query.eq("category", category);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchScheduledTournamentMatches(): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name, id)")
    .not("scheduled_at", "is", null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyTournamentMatches(playerId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(
      "id, tournament_id, category, round_name, team1_label, team2_label, court_number, scheduled_at, status, score, winner_side, player1_id, player2_id, player3_id, player4_id, tournaments(name, counts_for_elo)",
    )
    .or(
      `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`,
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function fetchMyTournamentMatchesForTab(profileId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      tournaments ( name )
    `)
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},player3_id.eq.${profileId},player4_id.eq.${profileId},umpired_by.eq.${profileId}`)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
