/**
 * Tournament officials (tournament_officials): roles of a user, lists,
 * referee rows, assign and remove.
 */
import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/lib/supabase-types-auto";

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

export async function fetchUserTournamentRoles(tournamentId: string, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("tournament_officials")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((d) => d.role);
}
