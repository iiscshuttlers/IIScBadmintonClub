import { supabase } from "@/lib/supabase";

/**
 * The only client paths to player contact details. Each is a checked
 * SECURITY DEFINER RPC (migration 20261113180000):
 *  - own details;
 *  - site administrators;
 *  - tournament contacts by role (officials/admins, or opponents when the
 *    organiser has enabled contacts);
 *  - account linking and exact-address lookup, without returning contact data.
 */

export interface PlayerPrivate {
  id: string;
  email: string | null;
  iisc_email: string | null;
  contact_number: string | null;
  sr_number: string | null;
}

// Called through the client object: `supabase.rpc` needs its `this`.
const rpc = (
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: any; error: { code?: string; message: string } | null }> =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => any }).rpc(fn, args);

export async function fetchMyPrivate(): Promise<PlayerPrivate | null> {
  const { data, error } = await rpc("get_my_player_private");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PlayerPrivate) ?? null;
}

export async function resolveMyPlayerId(): Promise<string | null> {
  const { data, error } = await rpc("resolve_my_player_id");
  if (error) return null;
  return (data as string) ?? null;
}

/** Admin-only. Returns an id → private map (empty for non-admins). */
export async function fetchAdminPrivate(ids: string[]): Promise<Record<string, PlayerPrivate>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const out: Record<string, PlayerPrivate> = {};
  // Chunk to keep request URLs/bodies small.
  for (let i = 0; i < unique.length; i += 500) {
    const { data, error } = await rpc("admin_get_player_private", { p_ids: unique.slice(i, i + 500) });
    if (error) throw error;
    for (const r of (data ?? []) as PlayerPrivate[]) out[r.id] = r;
  }
  return out;
}

/** Merge admin-only private fields into rows (no-op when unavailable). */
export async function withAdminPrivate<T extends { id: string }>(rows: T[]): Promise<Array<T & Partial<PlayerPrivate>>> {
  let map: Record<string, PlayerPrivate> = {};
  try {
    map = await fetchAdminPrivate(rows.map((r) => r.id));
  } catch {
    map = {};
  }
  return rows.map((r) => ({ ...r, ...(map[r.id] ? { ...map[r.id], id: r.id } : {}) }));
}

export async function adminSearchPlayersByEmail(query: string) {
  const { data, error } = await rpc("admin_search_players_by_email", { p_query: query });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; full_name: string; email: string | null; iisc_email: string | null; is_guest: boolean }>;
}

/** Exact email → public identity (no contact data). */
export async function findPlayerByEmail(email: string) {
  const { data, error } = await rpc("find_player_by_email", { p_email: email });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as { id: string; full_name: string; gender: string | null; is_guest: boolean; avatar_url: string | null } | null;
}

/** Another player's ID already using this address, or null. */
export async function playerEmailInUse(email: string): Promise<string | null> {
  const { data, error } = await rpc("player_email_in_use", { p_email: email });
  if (error) throw error;
  return (data as string) ?? null;
}

/** Phone numbers the caller may see for this tournament (server decides). */
export async function fetchTournamentContacts(
  tournamentId: string,
  playerIds: string[],
): Promise<Record<string, { id: string; name: string; contact_number: string | null }>> {
  const ids = Array.from(new Set(playerIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await rpc("get_tournament_contacts", { p_tournament_id: tournamentId, p_player_ids: ids });
  if (error) return {};
  const map: Record<string, { id: string; name: string; contact_number: string | null }> = {};
  for (const r of (data ?? []) as Array<{ id: string; full_name: string; contact_number: string | null }>) {
    map[r.id] = { id: r.id, name: r.full_name, contact_number: r.contact_number };
  }
  return map;
}

/** Officials of a tournament with any phone numbers the caller may see. */
export async function fetchTournamentOfficialsWithContacts(
  tournamentId: string,
): Promise<Array<{ id: string; name: string; contact_number: string | null; role: string }>> {
  const { data: offRows, error } = await supabase
    .from("tournament_officials")
    .select("user_id, role")
    .eq("tournament_id", tournamentId);
  if (error || !offRows?.length) return [];
  const ids = Array.from(new Set(offRows.map((o) => o.user_id as string)));
  const [{ data: people }, contacts] = await Promise.all([
    supabase.from("players").select("id, full_name").in("id", ids),
    fetchTournamentContacts(tournamentId, ids),
  ]);
  return offRows.map((o) => ({
    id: o.user_id as string,
    name: people?.find((p) => p.id === o.user_id)?.full_name ?? "Unknown",
    contact_number: contacts[o.user_id as string]?.contact_number ?? null,
    role: o.role as string,
  }));
}

/** Entry emails for a tournament (organisers/officials only; {} otherwise). */
export async function fetchParticipantEmails(tournamentId: string): Promise<Record<string, string>> {
  const { data, error } = await rpc("get_participant_emails", { p_tournament_id: tournamentId });
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; email: string }>) out[r.id] = r.email;
  return out;
}

/** Claimants' contacts the caller may see (post author, claimant, admins). */
export async function fetchFindLostClaimContacts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data, error } = await rpc("get_find_lost_claim_contacts", { p_ids: ids });
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ id: string; claim_contact: string }>) out[r.id] = r.claim_contact;
  return out;
}
