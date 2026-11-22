/**
 * Tournament rows: list, lookups and pickers, create/update/delete, archive,
 * clone, lifecycle readiness and transitions, and the organiser's contacts
 * setting.
 */
import { supabase } from "@/lib/supabase";
import { cloneTournament } from "@/lib/cloneTournament";
import { parseContactsMode, type ContactsMode } from "@/lib/tournamentContacts";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase-types-auto";
import type { Tournament, TournamentInsert } from "@/types/tournament";
import type { LifecycleAction, LifecycleReadinessReport } from "@/lib/tournamentReadiness";

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

export async function cloneTournamentFull(id: string, createdBy?: string | null): Promise<Tournament> {
  const src = await fetchTournamentById(id);
  const { tournament } = await cloneTournament(src, createdBy);
  return tournament as Tournament;
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

/** A tournament's name, or null (missing row or error). */
export async function fetchTournamentName(id: string): Promise<string | null> {
  const { data } = await supabase.from("tournaments").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
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

/** The organiser's contacts setting (see lib/tournamentContacts). */
export async function getTournamentContactsMode(tournamentId: string): Promise<ContactsMode> {
  const { data, error } = await supabase
    .from("site_data")
    .select("value")
    .eq("key", `tournament_contacts_${tournamentId}`)
    .maybeSingle();
  if (error) throw error;
  return parseContactsMode(data?.value);
}

export async function setTournamentContactsMode(tournamentId: string, mode: ContactsMode): Promise<void> {
  const { error } = await supabase
    .from("site_data")
    .upsert({ key: `tournament_contacts_${tournamentId}`, value: { mode } }, { onConflict: "key" });
  if (error) throw error;
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

/** One tournaments row (every column), or null (missing row or error). */
export async function fetchTournamentRowOrNull(id: string) {
  const { data } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}
