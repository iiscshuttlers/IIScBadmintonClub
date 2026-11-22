/**
 * Player registrations (tournament_registrations): lists, review, the
 * player's own registration, withdrawal, and payment receipt URLs.
 */
import { supabase } from "@/lib/supabase";
import type { TablesInsert } from "@/lib/supabase-types-auto";
import type { Registration } from "@/types/tournament";

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
