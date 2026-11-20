import { supabase } from '@/lib/supabase';
import { cloneTournament } from '@/lib/cloneTournament';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase-types-auto';
import type {
  Tournament,
  TournamentInsert,
  Participant,
  ParticipantInsert,
  TournamentMatch,
  Registration,
} from '@/types/tournament';
import type { ScoreConflictState, ScoreCorrectionResult } from '@/types/umpire';
import type { LifecycleAction, LifecycleReadinessReport } from '@/lib/tournamentReadiness';
import { PARTICIPANT_PUBLIC_COLUMNS } from "@/lib/playerColumns";
import { MATCH_VIEW_COLUMNS } from "@/lib/matchView";

export async function fetchTournaments(opts?: { status?: string[] }): Promise<Tournament[]> {
  let query = supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (opts?.status && opts.status.length > 0) {
    query = query.in("status", opts.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function fetchTournamentById(id: string): Promise<Tournament> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Tournament;
}

export async function createTournament(payload: TournamentInsert): Promise<Tournament> {
  const insertable = payload;
  const { data, error } = await supabase
    .from("tournaments")
    .insert(insertable as TablesInsert<"tournaments">)
    .select()
    .single();

  if (error) throw error;
  return data as Tournament;
}

export async function updateTournament(id: string, patch: Partial<Tournament>): Promise<void> {
  const { id: _ignoredId, created_at: _ignoredCreatedAt, ...rest } = patch;
  const { error } = await supabase
    .from("tournaments")
    .update(rest as TablesUpdate<"tournaments">)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function archiveTournament(id: string): Promise<void> {
  const { error } = await supabase.rpc("archive_tournament", {
    p_tournament_id: id,
  });

  if (error) {
    // Fallback if RPC is not available or throws: update status and archived_at directly
    const { error: updateError } = await supabase
      .from("tournaments")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw updateError;
  }
}

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

/** The 15 most recently created matches (any tournament) with their tournament name. Returns null on error. */
export async function fetchRecentTournamentMatchesWithNames() {
  const { data } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name)")
    .order("created_at", { ascending: false }) // tournament_matches has no updated_at; that 400ed on every home load
    .limit(15);
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

/** Applies `patch` to one tournament_matches row and returns `{ error }` (updateTournamentMatch throws instead). */
export async function updateTournamentMatchResult(id: string, patch: TablesUpdate<"tournament_matches">) {
  const { error } = await supabase
    .from("tournament_matches")
    .update(patch)
    .eq("id", id);
  return { error };
}

/** Applies `patch` to every rubber (tournament_matches row) of a tie and returns `{ error }`. */
export async function updateTieRubbersResult(tieId: string, patch: TablesUpdate<"tournament_matches">) {
  const { error } = await supabase
    .from("tournament_matches")
    .update(patch)
    .eq("tie_id", tieId);
  return { error };
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

export async function updateTournamentMatch(id: string, patch: Partial<TournamentMatch>): Promise<void> {
  const { id: _id, created_at: _created, ...matchUpdate } = patch;
  const { error } = await supabase
    .from("tournament_matches")
    .update(matchUpdate as TablesUpdate<"tournament_matches">)
    .eq("id", id);

  if (error) throw error;
}

export async function adminUpdateTournamentMatch(
  id: string,
  patch: Partial<TournamentMatch>,
  reason: string,
  operationId = crypto.randomUUID(),
): Promise<{ applied: boolean; eventId?: number }> {
  const { id: _id, created_at: _created, ...safePatch } = patch;
  const { data, error } = await supabase.rpc("admin_update_tournament_match", {
    p_match_id: id,
    p_patch: safePatch as Json,
    p_reason: reason,
    p_operation_id: operationId,
  });
  if (error) throw error;
  const result = (data ?? {}) as { applied?: boolean; event_id?: number };
  return { applied: !!result.applied, eventId: result.event_id };
}

export async function advanceTournamentWinner(matchId: string, _winnerId?: string): Promise<void> {
  const { error } = await supabase.rpc("advance_tournament_winner", {
    p_match_id: matchId,
  });

  if (error) throw error;
}

export async function fetchTournamentParticipants(tournamentId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select(PARTICIPANT_PUBLIC_COLUMNS)
    .eq("tournament_id", tournamentId)
    .order("seed", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Participant[];
}

/** Seeded entries (category, player_id, partner_id, seed) of a tournament. Returns null on error. */
export async function fetchTournamentSeedRows(tournamentId: string) {
  const { data } = await supabase
    .from("tournament_participants")
    .select("category, player_id, partner_id, seed")
    .eq("tournament_id", tournamentId)
    .not("seed", "is", null);
  return data;
}

/**
 * Public participant columns with the player's and partner's name and
 * department, by category then seed. Returns null on error.
 */
export async function fetchParticipantsWithDepartments(tournamentId: string) {
  const { data } = await supabase
    .from("tournament_participants")
    .select(`
        ${PARTICIPANT_PUBLIC_COLUMNS},
        player:player_id (full_name, department),
        partner:partner_id (full_name, department)
      `)
    .eq("tournament_id", tournamentId)
    .order("category")
    .order("seed", { ascending: true });
  return data;
}

/** Who entered which category of a tournament (player_id, partner_id, tournament_id, category). Returns null on error. */
export async function fetchTournamentEntryIds(tournamentId: string) {
  const { data } = await supabase
    .from("tournament_participants")
    .select("player_id, partner_id, tournament_id, category")
    .eq("tournament_id", tournamentId);
  return data;
}

export async function bulkUpsertParticipants(rows: ParticipantInsert[]): Promise<void> {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase
    .from("tournament_participants")
    .upsert(rows as TablesInsert<"tournament_participants">[], { onConflict: "id" });

  if (error) throw error;
}

export async function addTournamentParticipant(participant: {
  tournament_id: string;
  category: string;
  player_id?: string | null;
  partner_id?: string | null;
  display_name: string;
  seed?: number | null;
}): Promise<void> {
  const { error } = await supabase.from("tournament_participants").insert(participant as TablesInsert<"tournament_participants">);
  if (error) throw error;
}

export async function deleteTournamentParticipant(id: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_participants")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTournamentParticipants(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("tournament_participants")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function updateTournamentParticipant(
  id: string,
  patch: Partial<Participant>,
): Promise<void> {
  const { id: _id, ...partUpdate } = patch;
  const { error } = await supabase
    .from("tournament_participants")
    .update(partUpdate as TablesUpdate<"tournament_participants">)
    .eq("id", id);
  if (error) throw error;
}

export async function updateTournamentParticipants(
  updates: Array<{ id: string; patch: Partial<Participant> }>,
): Promise<void> {
  if (!updates.length) return;
  await Promise.all(
    updates.map((u) => {
      const { id: _id, ...patch } = u.patch;
      return supabase
        .from("tournament_participants")
        .update(patch as TablesUpdate<"tournament_participants">)
        .eq("id", u.id);
    }),
  );
}

export async function createTournamentMatches(
  matches: TablesInsert<"tournament_matches">[],
): Promise<Tables<"tournament_matches">[]> {
  if (!matches.length) return [];
  const { data, error } = await supabase
    .from("tournament_matches")
    .insert(matches)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function deleteTournamentMatchesByTournament(
  tournamentId: string,
  category?: string,
): Promise<void> {
  let query = supabase
    .from("tournament_matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (category) {
    query = query.eq("category", category);
  }
  const { error } = await query;
  if (error) throw error;
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

export async function fetchTournamentRegistrations(tournamentId: string): Promise<Registration[]> {
  const { data, error } = await supabase
    .from("tournament_registrations")
    .select("id, tournament_id, status, full_name, email, phone, categories, partner_names, transaction_id, message, created_at, player:players!tournament_registrations_player_id_fkey(id, full_name, avatar_url)")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Registration[];
}

export async function approveTournamentRegistration(id: string, reviewerId?: string | null): Promise<void> {
  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status: "approved",
      reviewed_by: reviewerId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function rejectTournamentRegistration(id: string, reviewerId?: string | null): Promise<void> {
  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status: "rejected",
      reviewed_by: reviewerId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/** Every registration across all tournaments, newest first. Returns null on error. */
/** Registrations panel rows (with the registering player), newest first, as `{ data, error }`. */
export async function fetchTournamentRegistrationRows(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_registrations")
    .select("id, status, full_name, email, phone, categories, partner_names, transaction_id, message, created_at, player:players!tournament_registrations_player_id_fkey(id, full_name, avatar_url)")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });
  return { data, error };
}

/**
 * Approves or rejects one registration with the reviewer stamp and returns
 * `{ error }` (approve/rejectTournamentRegistration throw instead).
 */
export async function reviewTournamentRegistration(
  id: string,
  status: "approved" | "rejected",
  reviewerId: string | null,
) {
  const { error } = await supabase
    .from("tournament_registrations")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  return { error };
}

/** The player's own registration (id, status, categories) for a tournament, or null (none or error). */
export async function fetchMyTournamentRegistration(tournamentId: string, playerId: string) {
  const { data } = await supabase
    .from("tournament_registrations")
    .select("id, status, categories")
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .maybeSingle();
  return data;
}

/** Inserts or replaces the player's registration (unique on tournament_id, player_id); returns `{ error }`. */
export async function upsertTournamentRegistration(row: TablesInsert<"tournament_registrations">) {
  const { error } = await supabase
    .from("tournament_registrations")
    .upsert(row, { onConflict: "tournament_id,player_id" });
  return { error };
}

/** Marks one registration withdrawn; returns `{ error }`. */
export async function withdrawTournamentRegistration(id: string) {
  const { error } = await supabase
    .from("tournament_registrations")
    .update({ status: "withdrawn" })
    .eq("id", id);
  return { error };
}

/**
 * Number of entries in a tournament (rows in tournament_participants, one per
 * player or pair per category). Same figure as the "N entered" count on the
 * tournaments list, which embeds `tournament_participants(count)`. Counting
 * approved registrations instead missed every player added directly by the
 * organiser. Throws on error.
 */
export async function countTournamentEntries(tournamentId: string): Promise<number> {
  const { count, error } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAllTournamentRegistrations() {
  const { data, error } = await supabase
    .from("tournament_registrations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return null;
  return data;
}

/** Sets only the status column (no reviewer stamp, unlike approve/rejectTournamentRegistration). */
export async function setTournamentRegistrationStatus(
  id: string,
  status: "approved" | "rejected" | "pending",
): Promise<void> {
  const { error } = await supabase
    .from("tournament_registrations")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

/** Public URL of an uploaded payment receipt in the tournament_receipts bucket. */
export function getTournamentReceiptUrl(receiptPath: string): string {
  return supabase.storage
    .from("tournament_receipts")
    .getPublicUrl(receiptPath).data.publicUrl;
}

export async function cloneTournamentFull(id: string, createdBy?: string | null): Promise<Tournament> {
  const src = await fetchTournamentById(id);
  const { tournament } = await cloneTournament(src, createdBy);
  return tournament as Tournament;
}

export async function deleteTournamentMatch(id: string): Promise<void> {
  const { error } = await supabase.from("tournament_matches").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteTournamentMatches(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("tournament_matches").delete().in("id", ids);
  if (error) throw error;
}

export async function fetchTournamentParticipantsByCategory(
  tournamentId: string,
  category: string
): Promise<Array<{ id: string; player_id: string | null; partner_id: string | null; display_name: string | null; category: string }>> {
  const { data, error } = await supabase
    .from("tournament_participants")
    .select("id, player_id, partner_id, display_name, category")
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .order("seed");

  if (error) throw error;
  return data ?? [];
}

export interface TournamentResultSubmission {
  applied: boolean;
  revision: number;
  operation_id: string | null;
  reason: "applied" | "already_applied";
}

export interface TournamentStartReceipt {
  applied: boolean;
  reason: "started" | "already_started";
  started_at: string | null;
}

export async function startTournamentMatchChecked(params: {
  p_match_id: string;
  p_expected_court?: string | null;
  p_expected_scheduled_at?: string | null;
}): Promise<TournamentStartReceipt> {
  const { data, error } = await supabase.rpc("start_tournament_match_checked", {
    p_match_id: params.p_match_id,
    p_expected_court: params.p_expected_court ?? null,
    p_expected_scheduled_at: params.p_expected_scheduled_at ?? null,
  });
  if (error) throw error;
  return data as unknown as TournamentStartReceipt;
}

export async function submitTournamentMatch(params: {
  p_match_id: string;
  p_winner_side: number;
  p_score: string;
  p_sets?: string[];
  p_umpire_id?: string | null;
  p_expected_revision?: number;
  p_operation_id?: string;
}): Promise<TournamentResultSubmission> {
  const { data, error } = await supabase.rpc("submit_tournament_match_v2", {
    p_match_id: params.p_match_id,
    p_winner_side: params.p_winner_side,
    p_score: params.p_score,
    p_sets: params.p_sets || [],
    p_umpire_id: params.p_umpire_id ?? null,
    p_expected_revision: params.p_expected_revision ?? 0,
    p_operation_id: params.p_operation_id ?? crypto.randomUUID(),
  });
  if (error) throw error;
  return data as unknown as TournamentResultSubmission;
}

export async function fetchTournamentMatchConflictContext(params: {
  matchId: string;
  localRevision: number;
  localWinnerSide: 1 | 2;
  localScore: string;
  localSets: string[];
  operationId?: string;
  team1Label?: string;
  team2Label?: string;
}): Promise<ScoreConflictState> {
  const { data: match, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, tournament_id, category, round, match_code, match_number, status,
      winner_side, winner_id, score, sets_history,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label, umpired_by, scored_by, scored_at,
      advances_to_match, advances_to_match_loser,
      result_revision, result_operation_id
    `)
    .eq("id", params.matchId)
    .single();

  if (error || !match) {
    throw error || new Error("Match not found on server");
  }

  // Look up last actor name if available
  let lastActorName: string | undefined;
  const actorId = match.scored_by || match.umpired_by;
  if (actorId) {
    const { data: actor } = await supabase
      .from("players")
      .select("full_name")
      .eq("id", actorId)
      .maybeSingle();
    lastActorName = actor?.full_name;
  }

  // Check if downstream match has started
  let downstreamStarted = false;
  let downstreamMatchCode: string | undefined;
  const nextCodes = [match.advances_to_match, match.advances_to_match_loser].filter(Boolean) as string[];
  if (nextCodes.length > 0 && match.tournament_id) {
    const { data: downstreamMatches } = await supabase
      .from("tournament_matches")
      .select("id, match_code, status, score, started_at")
      .eq("tournament_id", match.tournament_id)
      .in("match_code", nextCodes);

    const activeDownstream = downstreamMatches?.find(
      (m) =>
        m.status === "in_progress" ||
        m.status === "live" ||
        m.status === "completed" ||
        m.status === "walkover" ||
        Boolean(m.score) ||
        Boolean(m.started_at)
    );
    if (activeDownstream) {
      downstreamStarted = true;
      downstreamMatchCode = activeDownstream.match_code || undefined;
    }
  }

  return {
    matchId: params.matchId,
    tournamentId: match.tournament_id || undefined,
    matchNumber: match.match_number ? String(match.match_number) : undefined,
    category: match.category || undefined,
    team1Label: match.team1_label || params.team1Label || "Team 1",
    team2Label: match.team2_label || params.team2Label || "Team 2",
    localRevision: params.localRevision,
    serverRevision: Number(match.result_revision ?? 0),
    localWinnerSide: params.localWinnerSide,
    localScore: params.localScore,
    localSets: params.localSets,
    serverWinnerSide: (match.winner_side as 1 | 2 | null) ?? null,
    serverScore: match.score,
    serverSets: match.sets_history,
    serverStatus: match.status,
    operationId: params.operationId,
    lastActorName,
    lastActorId: actorId || undefined,
    lastUpdatedAt: match.scored_at || undefined,
    downstreamStarted,
    downstreamMatchCode,
  };
}

export async function applyTournamentMatchCorrection(params: {
  matchId: string;
  winnerSide: 1 | 2;
  score: string;
  sets: string[];
  expectedRevision: number;
  reason: string;
  operationId?: string;
}): Promise<ScoreCorrectionResult> {
  const { data, error } = await supabase.rpc("apply_tournament_match_correction", {
    p_match_id: params.matchId,
    p_winner_side: params.winnerSide,
    p_score: params.score,
    p_sets: params.sets,
    p_expected_revision: params.expectedRevision,
    p_reason: params.reason,
    p_operation_id: params.operationId ?? crypto.randomUUID(),
  });

  if (error) throw error;
  return data as unknown as ScoreCorrectionResult;
}

export async function overrideTournamentSchedule(params: {
  tournamentId: string;
  matchId: string;
  court: string;
  scheduledAt: string;
  reason: string;
  conflictType?: string;
  conflictingId?: string;
}): Promise<{ applied: boolean; match_id: string; court_number: string; scheduled_at: string }> {
  const { data, error } = await supabase.rpc("override_tournament_schedule", {
    p_tournament_id: params.tournamentId,
    p_match_id: params.matchId,
    p_court: params.court,
    p_scheduled_at: params.scheduledAt,
    p_reason: params.reason,
    p_conflict_type: params.conflictType ?? "warning",
    p_conflicting_id: params.conflictingId ?? null,
  });

  if (error) throw error;
  return data as unknown as { applied: boolean; match_id: string; court_number: string; scheduled_at: string };
}

export async function verifyTournamentReadiness(
  tournamentId: string,
  action: LifecycleAction
): Promise<LifecycleReadinessReport> {
  const { data, error } = await supabase.rpc("verify_tournament_readiness", {
    p_tournament_id: tournamentId,
    p_action: action,
  });
  if (error) throw error;
  return data as unknown as LifecycleReadinessReport;
}

export async function transitionTournamentLifecycle(
  tournamentId: string,
  action: LifecycleAction
): Promise<{ applied: boolean; action: LifecycleAction; tournament_id: string; report: LifecycleReadinessReport }> {
  const { data, error } = await supabase.rpc("transition_tournament_lifecycle", {
    p_tournament_id: tournamentId,
    p_action: action,
  });
  if (error) throw error;
  return data as unknown as { applied: boolean; action: LifecycleAction; tournament_id: string; report: LifecycleReadinessReport };
}

export async function undoTournamentMatch(matchId: string): Promise<void> {
  const { error } = await supabase.rpc("undo_tournament_match", { p_match_id: matchId });
  if (error) throw error;
}

export async function recordTournamentWalkover(params: {
  p_match_id: string;
  p_winner_side: number;
  p_umpire_id?: string | null;
  p_is_double_walkover?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("record_tournament_walkover", {
    p_match_id: params.p_match_id,
    p_winner_side: params.p_winner_side,
    p_scored_by: params.p_umpire_id ?? undefined,
  });
  if (error) throw error;
}

export async function notifyTournamentMatch(matchId: string, type: string = "manual"): Promise<void> {
  const { error } = await supabase.functions.invoke("match-notifier", {
    body: { match_id: matchId, type },
  });
  if (error) throw error;
}

export async function fetchTournamentRoundRules(tournamentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_round_rules")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (error) throw error;
  return data ?? [];
}

export async function invokeCallToCourt(payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("call-to-court", {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export async function getUserTournamentRoles(tournamentId: string, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("tournament_officials")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);
  return new Set((data || []).map((o) => o.role));
}

export async function assignTournamentOfficial(params: {
  tournament_id: string;
  user_id: string;
  role: string;
  assigned_by?: string;
}): Promise<void> {
  const { error } = await supabase.from("tournament_officials").insert(params as TablesInsert<"tournament_officials">);
  if (error) throw error;
}

export const NOTICES_BUCKET = "tournament_notices";

export async function listTournamentNotices(folder: string): Promise<any[]> {
  const { data, error } = await supabase.storage.from(NOTICES_BUCKET).list(folder, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (data || []).filter((f) => f.name !== ".emptyFolderPlaceholder");
}

export async function uploadTournamentNotice(folder: string, fileName: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(NOTICES_BUCKET).upload(`${folder}/${fileName}`, file);
  if (error) throw error;
}

export async function deleteTournamentNotice(folder: string, fileName: string): Promise<void> {
  const { error } = await supabase.storage.from(NOTICES_BUCKET).remove([`${folder}/${fileName}`]);
  if (error) throw error;
}

export function getTournamentNoticePublicUrl(folder: string, fileName: string): string {
  return supabase.storage.from(NOTICES_BUCKET).getPublicUrl(`${folder}/${fileName}`).data.publicUrl;
}

/** Uploads `file` as `fileName` at the root of the notices bucket and returns its public URL. */
export async function uploadNoticeFile(fileName: string, file: File): Promise<string> {
  const { error } = await supabase.storage
    .from(NOTICES_BUCKET)
    .upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage
    .from(NOTICES_BUCKET)
    .getPublicUrl(fileName);
  return data.publicUrl;
}

export async function upsertTournamentRoundRule(rule: {
  tournament_id: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}): Promise<void> {
  const { error } = await supabase.from("tournament_round_rules").upsert(rule, {
    onConflict: "tournament_id,category,round",
  });
  if (error) throw error;
}

/**
 * Saves one round's scoring rule and copies it onto that round's matches, in
 * one transaction (set_tournament_round_rule). The host and admins may call
 * it. If the function is not on the database yet, falls back to the two
 * direct writes, which only admins can make.
 */
export async function setTournamentRoundRule(rule: {
  tournament_id: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}): Promise<void> {
  const { error } = await supabase.rpc("set_tournament_round_rule", {
    p_tournament_id: rule.tournament_id,
    p_category: rule.category,
    p_round: rule.round,
    p_round_name: rule.round_name,
    p_points_to_win: rule.points_to_win,
    p_best_of_sets: rule.best_of_sets,
    p_golden_point: rule.golden_point,
  });
  if (!error) return;
  // PGRST202: PostgREST has no such function (migration not applied yet).
  if (error.code !== "PGRST202") throw error;
  await upsertTournamentRoundRule(rule);
  await updateMatchesScoringRule(rule.tournament_id, rule.category, rule.round, {
    points_to_win: rule.points_to_win,
    best_of_sets: rule.best_of_sets,
    golden_point: rule.golden_point,
  });
}

export async function updateMatchesScoringRule(
  tournamentId: string,
  category: string,
  round: number,
  vals: { points_to_win: number; best_of_sets: number; golden_point: number }
): Promise<void> {
  const { error } = await supabase
    .from("tournament_matches")
    .update(vals)
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .eq("round", round);
  if (error) throw error;
}

export async function fetchTournamentMatchesForRounds(tournamentId: string): Promise<Array<{ category: string; round: number; round_name: string | null }>> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("category, round, round_name")
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayerCertificatesMatchesAndOfficials(tournamentId: string, playerId: string) {
  const ors = ["player1_id", "player2_id", "player3_id", "player4_id"]
    .map((c) => `${c}.eq.${playerId}`)
    .join(",");
  const [{ data: matches, error: mErr }, { data: officials, error: oErr }] = await Promise.all([
    supabase
      .from("tournament_matches")
      .select("category, round_name, match_code, status, winner_side, player1_id, player2_id, player3_id, player4_id")
      .eq("tournament_id", tournamentId)
      .or(ors),
    supabase
      .from("tournament_officials")
      .select("role")
      .eq("tournament_id", tournamentId)
      .eq("user_id", playerId),
  ]);
  if (mErr) throw mErr;
  if (oErr) throw oErr;
  return { matches: matches ?? [], officials: officials ?? [] };
}

export async function fetchBracketPredictions(tournamentId: string, category: string, userId: string) {
  const { data, error } = await supabase
    .from("bracket_predictions")
    .select("picks")
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.picks ?? {}) as Record<string, string>;
}

export async function saveBracketPredictions(payload: {
  tournament_id: string;
  category: string;
  user_id: string;
  picks: Json;
}): Promise<void> {
  const { error } = await supabase.from("bracket_predictions").upsert({
    ...payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchBracketLeaderboard(tournamentId: string, category: string) {
  const { data, error } = await supabase.rpc("bracket_leaderboard", {
    p_tournament: tournamentId,
    p_category: category,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTournamentFeedback(tournamentId: string, userId: string) {
  const [{ data: played }, { data: mine, error }] = await Promise.all([
    supabase.rpc("played_in_tournament", { p_tournament: tournamentId, p_uid: userId }),
    supabase
      .from("tournament_feedback")
      .select("rating, tags, comment")
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  return { played: !!played, mine };
}

export async function submitTournamentFeedback(payload: {
  tournament_id: string;
  user_id: string;
  rating: number;
  tags?: string[];
  comment?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("tournament_feedback").upsert({
    ...payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function fetchScheduledTournamentMatches(): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(name, id)")
    .not("scheduled_at", "is", null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTournamentOfficials(tournamentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tournament_officials")
    .select("id, role, user_id, user:players!tournament_officials_user_id_fkey(id, full_name, avatar_url)")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * The tournament's REFEREE rows. tournament_officials is readable by
 * signed-in users only (RLS), so visitors get no rows. Returns null on error.
 */
export async function fetchTournamentRefereeRows(tournamentId: string) {
  const { data } = await supabase
    .from("tournament_officials")
    .select("user_id, role")
    .eq("tournament_id", tournamentId)
    .eq("role", "REFEREE");
  return data;
}

/** A tournament's name, or null (missing row or error). */
export async function fetchTournamentName(id: string): Promise<string | null> {
  const { data } = await supabase.from("tournaments").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

export async function deleteTournamentOfficial(officialId: string): Promise<void> {
  const { error } = await supabase.from("tournament_officials").delete().eq("id", officialId);
  if (error) throw error;
}

export async function assignTournamentOfficials(
  rows: Array<{ tournament_id: string; user_id: string; role: string; assigned_by?: string | null }>
): Promise<void> {
  const { error } = await supabase.from("tournament_officials").insert(rows as TablesInsert<"tournament_officials">[]);
  if (error) throw error;
}

export async function fetchTvNextUpOverview(tournamentId: string) {
  const [{ data: t }, { data: rows, error }] = await Promise.all([
    supabase.from("tournaments").select("name").eq("id", tournamentId).maybeSingle(),
    supabase
      .from("tournament_matches")
      .select("id, court_number, status, scheduled_at, round, match_number, round_name, category, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, score")
      .eq("tournament_id", tournamentId)
      .not("court_number", "is", null)
      .in("status", ["in_progress", "scheduled", "playing", "ready", "warming_up", "paused"]),
  ]);
  if (error) throw error;
  return { name: t?.name ?? "", rows: rows ?? [] };
}

export async function fetchTvH2hHistory(allPlayerIds: string[]) {
  const or = allPlayerIds.flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`, `player3_id.eq.${id}`, `player4_id.eq.${id}`]).join(",");
  const [{ data: hist }, { data: players }] = await Promise.all([
    supabase
      .from("tournament_matches")
      .select("id, status, winner_side, player1_id, player2_id, player3_id, player4_id, score, ended_at, scheduled_at, tournaments(name)")
      .in("status", ["completed", "walkover"])
      .or(or)
      .limit(500),
    supabase.from("players").select("id, elo_rating").in("id", allPlayerIds),
  ]);
  return { hist: hist ?? [], players: players ?? [] };
}

export async function fetchTvNextUpMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, match_code, category, round, round_name, court_number, scheduled_at, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating)
    `)
    .eq("tournament_id", tournamentId)
    .in("status", ["scheduled", "in_progress", "completed"])
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTvDrawRevealMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, match_code, category, round, round_name, match_number, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id,
      team1_label, team2_label,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, singles_elo, tournament_elo, elo_rating)
    `)
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTournamentReportPanelData(tournamentId: string, requireAppRegistration: boolean) {
  const { data: matches, error: mErr } = await supabase
    .from("tournament_matches")
    .select(
      "id, match_code, category, round, round_name, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id, status, score, sets_history, winner_side, court_number, scheduled_at, started_at, ended_at, umpired_by",
    )
    .eq("tournament_id", tournamentId)
    .order("category", { ascending: true })
    .order("round", { ascending: true })
    .order("match_number", { ascending: true });
  if (mErr) throw mErr;

  const rows = matches ?? [];
  const umpIds = Array.from(new Set(rows.map((m) => m.umpired_by).filter(Boolean))) as string[];
  let umpireMap: Record<string, string> = {};
  if (umpIds.length) {
    const { data: ump } = await supabase.from("players").select("id, full_name").in("id", umpIds);
    umpireMap = Object.fromEntries((ump ?? []).map((p) => [p.id, p.full_name] as const));
  }

  const { data: fb } = await supabase
    .from("tournament_feedback")
    .select("rating, tags, comment")
    .eq("tournament_id", tournamentId);

  let regCount: number | null = null;
  if (requireAppRegistration) {
    const { count } = await supabase
      .from("tournament_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("status", "approved");
    regCount = count ?? null;
  }

  return { matches: rows, umpireNames: umpireMap, feedback: fb ?? [], registered: regCount };
}

export async function fetchTournamentReportData(tournamentId: string) {
  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (tErr) throw tErr;

  const { data: matches, error: mErr } = await supabase
    .from("tournament_matches")
    .select(`
      *,
      player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
      player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
      player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
      player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url)
    `)
    .eq("tournament_id", tournamentId);
  if (mErr) throw mErr;

  const { data: fb } = await supabase
    .from("tournament_feedback")
    .select("rating, tags, comment")
    .eq("tournament_id", tournamentId);

  const { count: participantCount } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  return {
    tournament: tourney,
    matches: matches ?? [],
    feedback: fb ?? [],
    participantCount: participantCount ?? 0,
  };
}

export async function fetchPathToFinalData(tournamentId: string, category: string) {
  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select("id, match_code, round, round_name, status, winner_side, advances_to_match, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, tie_id")
    .eq("tournament_id", tournamentId)
    .eq("category", category)
    .is("tie_id", null);
  if (error) throw error;
  const ids = Array.from(
    new Set((matches ?? []).flatMap((m) => [m.player1_id, m.player2_id, m.player3_id, m.player4_id]).filter(Boolean)),
  );
  const { data: players } = ids.length
    ? await supabase.from("players").select("id, tournament_elo, elo_rating").in("id", ids)
    : { data: [] as Array<Pick<Tables<"players">, "id" | "tournament_elo" | "elo_rating">> };
  return { matches: matches ?? [], players: players ?? [] };
}

export async function fetchPathToFinalMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(`
      id, category, round, round_name, match_number, match_code, status, winner_side, score,
      player1_id, player2_id, player3_id, player4_id, team1_label, team2_label,
      advances_to_match, advances_to_position
    `)
    .eq("tournament_id", tournamentId);
  if (error) throw error;
  return data ?? [];
}

export async function updateTournamentAndReturn(id: string, patch: Partial<Tournament>): Promise<Tournament> {
  const { id: _ignoredId, created_at: _ignoredCreatedAt, ...rest } = patch;
  const { data, error } = await supabase
    .from("tournaments")
    .update(rest as TablesUpdate<"tournaments">)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Tournament;
}

export async function getTournamentContacts(tournamentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("site_data")
    .select("value")
    .eq("key", `tournament_contacts_${tournamentId}`)
    .maybeSingle();
  if (error) throw error;
  return data?.value === true || (data?.value as { enabled?: unknown } | null)?.enabled === true;
}

export async function setTournamentContacts(tournamentId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("site_data")
    .upsert({ key: `tournament_contacts_${tournamentId}`, value: enabled }, { onConflict: "key" });
  if (error) throw error;
}

export const tournamentService = {
  fetchTournaments,
  fetchTournamentById,
  createTournament,
  updateTournament,
  updateTournamentAndReturn,
  deleteTournament,
  archiveTournament,
  fetchTournamentMatches,
  updateTournamentMatch,
  advanceTournamentWinner,
  fetchTournamentParticipants,
  bulkUpsertParticipants,
  addTournamentParticipant,
  deleteTournamentParticipant,
  deleteTournamentParticipants,
  updateTournamentParticipant,
  updateTournamentParticipants,
  createTournamentMatches,
  deleteTournamentMatchesByTournament,
  countTournamentMatches,
  fetchTournamentRegistrations,
  approveTournamentRegistration,
  rejectTournamentRegistration,
  cloneTournamentFull,
  submitTournamentMatch,
  startTournamentMatchChecked,
  overrideTournamentSchedule,
  verifyTournamentReadiness,
  transitionTournamentLifecycle,
  undoTournamentMatch,
  recordTournamentWalkover,
  notifyTournamentMatch,
  fetchTournamentRoundRules,
  upsertTournamentRoundRule,
  setTournamentRoundRule,
  updateMatchesScoringRule,
  fetchTournamentMatchesForRounds,
  invokeCallToCourt,
  getUserTournamentRoles,
  assignTournamentOfficial,
  listTournamentNotices,
  uploadTournamentNotice,
  deleteTournamentNotice,
  getTournamentNoticePublicUrl,
  fetchPlayerCertificatesMatchesAndOfficials,
  fetchBracketPredictions,
  saveBracketPredictions,
  fetchBracketLeaderboard,
  fetchTournamentFeedback,
  submitTournamentFeedback,
  fetchScheduledTournamentMatches,
  fetchTournamentOfficials,
  deleteTournamentOfficial,
  assignTournamentOfficials,
  fetchTvNextUpMatches,
  fetchTvDrawRevealMatches,
  fetchTournamentReportData,
  fetchTournamentReportPanelData,
  fetchPathToFinalMatches,
  fetchPathToFinalData,
  fetchMyTournamentMatches,
  fetchEloStakesContext,
  getTournamentContacts,
  setTournamentContacts,
  fetchTvNextUpOverview,
  fetchTvH2hHistory,
};



export async function fetchMyTournamentMatches(playerId: string) {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(
      "id, tournament_id, category, round_name, team1_label, team2_label, court_number, scheduled_at, status, score, player1_id, player2_id, player3_id, player4_id, tournaments(name, counts_for_elo)",
    )
    .or(
      `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`,
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function fetchEloStakesContext(playerId: string, playerIds: string[]) {
  const [{ data: players, error: errPlayers }, { count, error: errCount }, { data: cfgRow, error: errCfg }] = await Promise.all([
    supabase.from("players").select("id, tournament_elo, elo_rating").in("id", playerIds),
    supabase
      .from("tournament_matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId}`),
    supabase.from("site_data").select("value").eq("key", "elo_config").maybeSingle(),
  ]);
  if (errPlayers) throw errPlayers;
  if (errCount) throw errCount;
  if (errCfg) throw errCfg;
  return {
    players: players || [],
    completedCount: count ?? 0,
    eloConfig: (cfgRow?.value ?? {}) as Record<string, any>,
  };
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

export async function fetchLatestActiveTournament(): Promise<any | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, status, form_status, form_url, form_close_date, start_date, end_date, venue, eligibility")
    .neq("status", "deleted")
    .neq("status", "draft")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

/** At most one `active` tournament (id, name, status, format_family). Returns null on error. */
export async function fetchActiveTournamentRows() {
  const { data } = await supabase
    .from("tournaments")
    .select("id, name, status, format_family")
    .eq("status", "active")
    .limit(1);
  return data;
}

/** id and name of every tournament that is not deleted, newest first (pickers). Returns null on error. */
export async function fetchTournamentOptions() {
  const { data } = await supabase
    .from("tournaments")
    .select("id, name")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  return data;
}

/** Tournaments created by `userId` that are not deleted, newest first. Returns null on error. */
export async function fetchTournamentsCreatedBy(userId: string) {
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("created_by", userId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  return data;
}

/** The five newest tournaments that are not deleted (notice board). Returns null on error. */
export async function fetchLatestTournamentsForNotices() {
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(5);
  return data;
}

/** Tie points, tie format and bracket format of a tournament (team standings), as `{ data, error }`. */
export async function fetchTournamentStandingsConfig(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, tie_points_win, tie_points_draw, tie_format_config, bracket_format, format_family")
    .eq("id", tournamentId)
    .maybeSingle();
  return { data, error };
}

/** id and categories of one tournament, or null (missing row or error). */
export async function fetchTournamentCategories(id: string) {
  const { data } = await supabase
    .from("tournaments")
    .select("id, categories")
    .eq("id", id)
    .single();
  return data;
}

/** Rest and court policy columns of a tournament (order of play), as `{ data, error }`. */
export async function fetchTournamentSchedulingPolicy(tournamentId: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("min_rest_minutes, estimated_match_minutes, unavailable_court_periods")
    .eq("id", tournamentId)
    .maybeSingle();
  return { data, error };
}

/**
 * Umpire tab tournament picker (id, name), newest first: just `tournamentId`
 * when given, otherwise every active tournament. Returns null on error.
 */
export async function fetchUmpirePickerTournaments(tournamentId?: string | null) {
  let allTournamentsQuery = supabase
    .from("tournaments")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (tournamentId) {
    allTournamentsQuery = allTournamentsQuery.eq("id", tournamentId);
  } else {
    allTournamentsQuery = allTournamentsQuery.eq("status", "active");
  }

  const { data } = await allTournamentsQuery;
  return data;
}

/** Round rules of the given tournaments. Returns null on error. */
export async function fetchRoundRulesForTournaments(tournamentIds: string[]) {
  const { data } = await supabase
    .from("tournament_round_rules")
    .select("*")
    .in("tournament_id", tournamentIds);
  return data;
}

/** One tournaments row (every column), or null (missing row or error). */
export async function fetchTournamentRowOrNull(id: string) {
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

/**
 * Referee dashboard realtime: one channel with changes to the tournament's
 * matches and ties; both call `onChange`. Returns the cleanup.
 */
export function subscribeToRefereeBoard(tournamentId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`referee_matches_${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * Order-of-play realtime: one channel with changes to the tournament's
 * matches and ties; both call `onChange`. Returns the cleanup.
 */
export function subscribeToOrderOfPlay(tournamentId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`oop_matches_${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournamentId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Umpire tab: calls `onChange` on any change to tournament_matches (unfiltered). Returns the cleanup. */
export function subscribeToUmpireTournamentMatches(onChange: () => void): () => void {
  const channel = supabase
    .channel("umpire_tournament_matches")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_matches" },
      () => { onChange(); },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToTournaments(callback: () => void): () => void {
  const channel = supabase
    .channel("announcements_tournament_watch")
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
      callback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchUserTournamentRoles(tournamentId: string, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tournament_officials")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((d) => d.role);
}

export async function bulkImportParticipants(params: {
  tournamentId: string;
  category: string;
  entries: Array<{
    playerId: string | null;
    partnerId: string | null;
    displayName: string | null;
    seed: number | null;
    email: string | null;
    phone1?: string;
    phone2?: string;
  }>;
}): Promise<void> {
  const { data: existing } = await supabase
    .from("tournament_participants")
    .select("seed")
    .eq("tournament_id", params.tournamentId)
    .eq("category", params.category);

  const existingCount = existing?.length ?? 0;
  const maxExplicit = Math.max(0, ...params.entries.map((e) => e.seed ?? 0));
  let autoSeed = Math.max(existingCount, maxExplicit) + 1;

  for (const entry of params.entries) {
    await supabase.from("tournament_participants").insert({
      tournament_id: params.tournamentId,
      category: params.category,
      player_id: entry.playerId,
      partner_id: entry.partnerId,
      display_name: entry.displayName || null,
      seed: entry.seed ?? autoSeed++,
      email: entry.email,
    });

    if (entry.phone1 && entry.playerId) {
      await supabase.rpc("admin_fill_player_contact", { p_player_id: entry.playerId, p_contact: entry.phone1 }); // fills only if empty
    }
    if (entry.phone2 && entry.partnerId) {
      await supabase.rpc("admin_fill_player_contact", { p_player_id: entry.partnerId, p_contact: entry.phone2 }); // fills only if empty
    }
  }
}





