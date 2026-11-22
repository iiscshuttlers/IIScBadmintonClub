/**
 * Direct tournament_matches writes: draw creation and deletion, row and
 * tie-rubber updates, the reasoned admin update RPC and winner advancement.
 */
import { supabase } from "@/lib/supabase";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/lib/supabase-types-auto";
import type { TournamentMatch } from "@/types/tournament";

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

export async function deleteTournamentMatch(id: string): Promise<void> {
  const { error } = await supabase.from("tournament_matches").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteTournamentMatches(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("tournament_matches").delete().in("id", ids);
  if (error) throw error;
}
