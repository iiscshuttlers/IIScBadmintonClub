/**
 * In-app tournament registration: RPC wrappers and reads.
 *
 * Every write goes through the SECURITY DEFINER RPCs of migrations
 * 20261123150100 (player) and 20261123150200 (organiser). Until the Supabase
 * types are regenerated the RPC names are untyped, hence the casts here.
 *
 * Flag safety: reads that take a tournament return empty WITHOUT a network
 * call when `require_app_registration` is off, so a flag-off tournament never
 * queries the new tables.
 */
import { supabase } from "@/lib/supabase";
import { PARTICIPANT_REGISTRATION_COLUMNS } from "@/lib/playerColumns";
import type {
  AttentionResult, BackupStats, CategorySettings, ConflictItem, EntryEvent, EntryRowData, OrganiserSaveResult,
  PartnerRequest, RegistrationTournament, ReminderKind, ReminderResult, RpcStatus, SaveEntryInput, SaveResult,
  WaitlistRowData, WithdrawalRequest,
} from "@/types/registration";

/** In-app registration runs for this tournament (flag on, not a team event). */
export function isRegistrationFlagOn(t: Pick<RegistrationTournament, "require_app_registration" | "format_family"> | null | undefined): boolean {
  return !!t?.require_app_registration && (t.format_family ?? "").toUpperCase() !== "TEAM";
}

const FRIENDLY: Record<string, string> = {
  registration_sign_in: "Sign in and set up your profile to enter.",
  registration_not_in_app: "This tournament doesn't take entries in the app.",
  registration_forbidden: "Only the tournament's organisers can do that.",
  registration_bad_input: "Something in that request wasn't valid.",
};

/** Turn a Postgres error from a registration RPC into a readable Error. */
export function registrationError(err: { message?: string; code?: string } | null | undefined): Error {
  const msg = err?.message ?? "Something went wrong";
  const key = Object.keys(FRIENDLY).find((k) => msg.startsWith(k));
  if (!key) return new Error(msg);
  const detail = msg.slice(key.length).replace(/^:\s*/, "");
  return new Error(detail ? `${FRIENDLY[key]} (${detail})` : FRIENDLY[key]);
}

type RpcFn = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
const rpc: RpcFn = (fn, args) => (supabase.rpc as unknown as RpcFn)(fn, args);

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw registrationError(error);
  return data as T;
}

// Untyped on purpose: participants embed players twice (player_id, partner_id),
// which the generated types report as an ambiguous relationship. Resolved at
// call time so tests that mock the client after import still work.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (table: string) => (supabase.from as any)(table);

const SETTINGS_COLUMNS = "tournament_id, category, opens_at, closes_at, locked_at, locked_by, entries_visibility, max_entries, updated_at";
const WAITLIST_COLUMNS = "id, tournament_id, category, player_id, partner_id, created_at";
const REQUEST_COLUMNS = "id, tournament_id, category, from_player_id, to_player_id, status, stale_reason, created_at, responded_at";
const WITHDRAWAL_COLUMNS = "id, tournament_id, category, participant_id, requested_by, player_ids, reason, status, created_at, resolved_at";
const EVENT_COLUMNS = "id, tournament_id, category, participant_id, actor_id, action, player_ids, before, after, created_at";

// ------------------------------------------------------------------ reads --

export async function fetchCategorySettings(t: RegistrationTournament): Promise<CategorySettings[]> {
  if (!isRegistrationFlagOn(t)) return [];
  const { data, error } = await from("tournament_category_settings").select(SETTINGS_COLUMNS).eq("tournament_id", t.id);
  if (error) throw registrationError(error);
  return (data ?? []) as CategorySettings[];
}

/** Categories that already have draw matches. */
export async function fetchDrawnCategories(t: RegistrationTournament): Promise<string[]> {
  if (!isRegistrationFlagOn(t)) return [];
  const { data, error } = await supabase.from("tournament_matches").select("category").eq("tournament_id", t.id);
  if (error) throw registrationError(error);
  return [...new Set((data ?? []).map((r: { category: string | null }) => r.category).filter((c): c is string => !!c))];
}

const ENTRY_COLUMNS =
  `${PARTICIPANT_REGISTRATION_COLUMNS}, player:player_id (full_name, gender, is_guest), partner:partner_id (full_name, gender, is_guest)`;

export async function fetchRegistrationEntries(t: RegistrationTournament): Promise<EntryRowData[]> {
  if (!isRegistrationFlagOn(t)) return [];
  const { data, error } = await from("tournament_participants").select(ENTRY_COLUMNS).eq("tournament_id", t.id)
    .order("category").order("seed", { ascending: true });
  if (error) throw registrationError(error);
  return (data ?? []) as EntryRowData[];
}

export interface MyRegistration {
  entries: EntryRowData[];
  waitlist: WaitlistRowData[];
  requests: PartnerRequest[];
  withdrawals: WithdrawalRequest[];
  events: EntryEvent[];
}

export const EMPTY_MY_REGISTRATION: MyRegistration = { entries: [], waitlist: [], requests: [], withdrawals: [], events: [] };

/** Everything "My entry" needs for one player. RLS limits each table to the caller. */
export async function fetchMyRegistration(t: RegistrationTournament, playerId: string | null | undefined): Promise<MyRegistration> {
  if (!isRegistrationFlagOn(t) || !playerId) return EMPTY_MY_REGISTRATION;
  const either = `player_id.eq.${playerId},partner_id.eq.${playerId}`;
  const [entries, waitlist, requests, withdrawals, events] = await Promise.all([
    from("tournament_participants").select(ENTRY_COLUMNS).eq("tournament_id", t.id).or(either),
    from("tournament_waitlist").select(WAITLIST_COLUMNS).eq("tournament_id", t.id).order("created_at"),
    from("tournament_partner_requests")
      .select(`${REQUEST_COLUMNS}, from_player:from_player_id (full_name), to_player:to_player_id (full_name)`)
      .eq("tournament_id", t.id).or(`from_player_id.eq.${playerId},to_player_id.eq.${playerId}`)
      .order("created_at", { ascending: false }),
    from("tournament_withdrawal_requests").select(WITHDRAWAL_COLUMNS).eq("tournament_id", t.id).contains("player_ids", [playerId]),
    from("tournament_entry_events").select(EVENT_COLUMNS).eq("tournament_id", t.id).contains("player_ids", [playerId])
      .order("created_at", { ascending: false }).limit(50),
  ]);
  for (const r of [entries, waitlist, requests, withdrawals, events]) if (r.error) throw registrationError(r.error);
  return {
    entries: (entries.data ?? []) as EntryRowData[],
    waitlist: (waitlist.data ?? []) as WaitlistRowData[],
    requests: (requests.data ?? []) as PartnerRequest[],
    withdrawals: (withdrawals.data ?? []) as WithdrawalRequest[],
    events: (events.data ?? []) as EntryEvent[],
  };
}

/** Organiser reads (RLS: organisers see every row). */
export async function fetchOrganiserRegistration(t: RegistrationTournament) {
  if (!isRegistrationFlagOn(t)) {
    return { waitlist: [] as WaitlistRowData[], withdrawals: [] as WithdrawalRequest[], backup: { copied: 0, failed: 0, pending: 0 } as BackupStats };
  }
  const [waitlist, withdrawals, outbox] = await Promise.all([
    from("tournament_waitlist").select(WAITLIST_COLUMNS).eq("tournament_id", t.id).order("created_at"),
    from("tournament_withdrawal_requests").select(WITHDRAWAL_COLUMNS).eq("tournament_id", t.id).order("created_at", { ascending: false }),
    from("tournament_backup_outbox").select("sent_at, attempts, last_error").eq("tournament_id", t.id),
  ]);
  for (const r of [waitlist, withdrawals, outbox]) if (r.error) throw registrationError(r.error);
  const rows = (outbox.data ?? []) as { sent_at: string | null; attempts: number; last_error: string | null }[];
  return {
    waitlist: (waitlist.data ?? []) as WaitlistRowData[],
    withdrawals: (withdrawals.data ?? []) as WithdrawalRequest[],
    backup: {
      copied: rows.filter((r) => r.sent_at).length,
      failed: rows.filter((r) => !r.sent_at && r.attempts >= 3).length,
      pending: rows.filter((r) => !r.sent_at && r.attempts < 3).length,
    } as BackupStats,
  };
}

/** Waitlist counts per category for viewers (works signed out). */
export async function fetchWaitlistCounts(t: RegistrationTournament): Promise<{ category: string; waiting: number }[]> {
  if (!isRegistrationFlagOn(t)) return [];
  return call<{ category: string; waiting: number }[]>("registration_waitlist_counts", { p_tournament_id: t.id }).then((d) => d ?? []);
}

// ----------------------------------------------------------- player RPCs --

export async function saveMyEntries(tournamentId: string, entries: SaveEntryInput[]): Promise<SaveResult[]> {
  const data = await call<{ results: SaveResult[] }>("save_my_tournament_entries", { p_tournament_id: tournamentId, p_entries: entries });
  return data?.results ?? [];
}

export const leaveMyPair = (tournamentId: string, category: string) =>
  call<RpcStatus>("leave_my_pair", { p_tournament_id: tournamentId, p_category: category });

export const withdrawMyEntry = (tournamentId: string, category: string) =>
  call<RpcStatus>("withdraw_my_entry", { p_tournament_id: tournamentId, p_category: category });

export const requestPartner = (tournamentId: string, category: string, toPlayerId: string) =>
  call<RpcStatus>("request_partner", { p_tournament_id: tournamentId, p_category: category, p_to_player_id: toPlayerId });

export const answerPartnerRequest = (requestId: string, accept: boolean) =>
  call<RpcStatus>("answer_partner_request", { p_request_id: requestId, p_accept: accept });

export const requestLateWithdrawal = (tournamentId: string, category: string, reason?: string | null) =>
  call<RpcStatus>("request_late_withdrawal", { p_tournament_id: tournamentId, p_category: category, p_reason: reason ?? null });

// -------------------------------------------------------- organiser RPCs --

export const setCategoryLock = (tournamentId: string, category: string, locked: boolean, newClosesAt?: string | null) =>
  call<RpcStatus>("set_category_lock", { p_tournament_id: tournamentId, p_category: category, p_locked: locked, p_new_closes_at: newClosesAt ?? null });

export const setCategorySettings = (tournamentId: string, category: string, settings: Partial<Pick<CategorySettings, "opens_at" | "closes_at" | "entries_visibility" | "max_entries">>) =>
  call<RpcStatus>("set_category_settings", { p_tournament_id: tournamentId, p_category: category, p_settings: settings });

export interface TimelinePatch {
  opens_at?: string | null;
  closes_at?: string | null;
  collect_payment?: boolean;
  max_events_per_player?: number | null;
  action?: "lock_all" | "reopen_all";
}
export const setRegistrationTimeline = (tournamentId: string, patch: TimelinePatch) =>
  call<RpcStatus & { categories?: Record<string, string> }>("set_registration_timeline", { p_tournament_id: tournamentId, p_patch: patch });

export const organiserSaveEntry = (args: {
  tournamentId: string; category: string; participantId?: string | null;
  playerId: string; partnerId?: string | null; guestPartner?: { name: string; phone?: string | null } | null;
}) => call<OrganiserSaveResult>("organiser_save_entry", {
  p_tournament_id: args.tournamentId, p_category: args.category, p_participant_id: args.participantId ?? null,
  p_player_id: args.playerId, p_partner_id: args.partnerId ?? null, p_guest_partner: args.guestPartner ?? null,
});

export const organiserRemoveEntry = (participantId: string, moveUp = false) =>
  call<RpcStatus & { moved_up?: number }>("organiser_remove_entry", { p_participant_id: participantId, p_move_up: moveUp });

export const promoteFromWaitlist = (tournamentId: string, category: string) =>
  call<{ moved_up: number }>("promote_from_waitlist", { p_tournament_id: tournamentId, p_category: category });

export const fetchAttention = (tournamentId: string) =>
  call<AttentionResult>("registration_attention", { p_tournament_id: tournamentId });

export const fetchPartnerConflicts = (tournamentId: string) =>
  call<ConflictItem[]>("tournament_partner_conflicts", { p_tournament_id: tournamentId }).then((d) => d ?? []);

export const sendEntryReminders = (args: {
  tournamentId: string; category?: string | null; kind: ReminderKind; playerIds?: string[] | null; note?: string | null;
}) => call<ReminderResult>("send_entry_reminders", {
  p_tournament_id: args.tournamentId, p_category: args.category ?? null, p_kind: args.kind,
  p_player_ids: args.playerIds && args.playerIds.length ? args.playerIds : null, p_note: args.note?.trim() || null,
});

export const resolveWithdrawalRequest = (requestId: string, action: "remove" | "walkover" | "dismiss") =>
  call<RpcStatus>("resolve_withdrawal_request", { p_request_id: requestId, p_action: action });

export interface PickerPlayer { id: string; full_name: string; gender: string | null }

/** Members a player can pick as a partner (public columns only; no guests). */
export async function fetchPickerPlayers(): Promise<PickerPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, gender")
    .eq("is_guest", false)
    .is("deleted_at", null)
    .order("full_name")
    .limit(2000);
  if (error) throw registrationError(error);
  return (data ?? []) as PickerPlayer[];
}

/** My waitlist position per category (players only see their own waitlist rows). */
export async function fetchMyWaitlistPositions(t: RegistrationTournament): Promise<{ category: string; waitlist_position: number }[]> {
  if (!isRegistrationFlagOn(t)) return [];
  return call<{ category: string; waitlist_position: number }[]>("my_waitlist_positions", { p_tournament_id: t.id }).then((d) => d ?? []);
}
