/**
 * Tournament entries (tournament_participants): reads, seeding rows, counts,
 * add/update/delete and bulk import.
 */
import { supabase } from "@/lib/supabase";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase-types-auto";
import type { Participant, ParticipantInsert } from "@/types/tournament";
import { PARTICIPANT_PUBLIC_COLUMNS } from "@/lib/playerColumns";

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
    // Every entry, seeded or not: entry counts decide which seeds are published.
    .eq("tournament_id", tournamentId);
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

/** Apply several participant patches. Every update is attempted; throws if any failed. */
export async function updateTournamentParticipants(
  updates: Array<{ id: string; patch: Partial<Participant> }>,
): Promise<void> {
  if (!updates.length) return;
  const results = await Promise.all(
    updates.map((u) => {
      const { id: _id, ...patch } = u.patch;
      return supabase
        .from("tournament_participants")
        .update(patch as TablesUpdate<"tournament_participants">)
        .eq("id", u.id);
    }),
  );
  const failed = results.filter((r) => r.error);
  if (failed.length) {
    throw new Error(
      `${failed.length} of ${updates.length} participant update${updates.length === 1 ? "" : "s"} failed: ${failed[0].error!.message}`,
    );
  }
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
  /** 'form' for fallback-form imports on in-app-registration tournaments; omitted otherwise (column default). */
  source?: "form";
}): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("tournament_participants")
    .select("seed")
    .eq("tournament_id", params.tournamentId)
    .eq("category", params.category);
  if (existingError) throw existingError;

  const existingCount = existing?.length ?? 0;
  const maxExplicit = Math.max(0, ...params.entries.map((e) => e.seed ?? 0));
  let autoSeed = Math.max(existingCount, maxExplicit) + 1;

  // Every entry is attempted; a failed row doesn't stop the rest, and the
  // caller gets one error naming what didn't import.
  const failed: string[] = [];
  for (const [i, entry] of params.entries.entries()) {
    const { error } = await supabase.from("tournament_participants").insert({
      tournament_id: params.tournamentId,
      category: params.category,
      player_id: entry.playerId,
      partner_id: entry.partnerId,
      display_name: entry.displayName || null,
      seed: entry.seed ?? autoSeed++,
      email: entry.email,
      ...(params.source ? { source: params.source } : {}),
    });
    if (error) {
      failed.push(`${entry.displayName || `row ${i + 1}`} (${error.message})`);
      continue;
    }

    // Contact numbers only fill empty fields; a failure here doesn't undo the entry.
    if (entry.phone1 && entry.playerId) {
      const { error: contactError } = await supabase.rpc("admin_fill_player_contact", { p_player_id: entry.playerId, p_contact: entry.phone1 });
      if (contactError) console.warn("Could not fill contact for", entry.playerId, contactError.message);
    }
    if (entry.phone2 && entry.partnerId) {
      const { error: contactError } = await supabase.rpc("admin_fill_player_contact", { p_player_id: entry.partnerId, p_contact: entry.phone2 });
      if (contactError) console.warn("Could not fill contact for", entry.partnerId, contactError.message);
    }
  }
  if (failed.length) {
    const imported = params.entries.length - failed.length;
    throw new Error(`Imported ${imported} of ${params.entries.length}. Not imported: ${failed.join("; ")}`);
  }
}
