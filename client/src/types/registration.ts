/**
 * In-app tournament registration types (hand-written until the Supabase types
 * are regenerated after migrations 20261123150000–150200 are applied).
 */
import type { RegistrationState } from "@/lib/registration/window";

export type { RegistrationState };

export type EntriesVisibility = "as_entered" | "after_close" | "after_draw" | "hidden";

/** The tournament fields registration reads. */
export interface RegistrationTournament {
  id: string;
  name?: string | null;
  status?: string | null;
  format_family?: string | null;
  categories?: string[] | null;
  require_app_registration?: boolean | null;
  registration_opens_at?: string | null;
  form_close_date?: string | null;
  form_url?: string | null;
  form_status?: string | null;
  show_participants?: boolean | null;
  ignore_gender_rules?: boolean | null;
  auto_reminders_enabled?: boolean | null;
  collect_payment?: boolean | null;
  max_events_per_player?: number | null;
  created_by?: string | null;
}

export interface CategorySettings {
  tournament_id: string;
  category: string;
  opens_at: string | null;
  closes_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  /** null = same as tournament (show_participants). */
  entries_visibility: EntriesVisibility | null;
  max_entries: number | null;
  updated_at?: string | null;
}

export interface GuestPartnerInput { name: string; phone?: string | null }

export interface SaveEntryInput {
  category: string;
  partner_id?: string | null;
  guest_partner?: GuestPartnerInput | null;
  looking_for_partner?: boolean;
}

export type SaveStatus = "entered" | "joined" | "unchanged" | "waitlisted" | "taken" | "refused";

export interface SaveResult {
  category: string;
  status: SaveStatus;
  reason?: string;
  participant_id?: string;
  partner_id?: string;
  with_player_id?: string;
  with_name?: string;
  position?: number;
  player_ids?: string[];
}

export interface RpcStatus {
  status: string;
  reason?: string;
  request_id?: string;
  participant_id?: string;
  [key: string]: unknown;
}

export interface EntryRowData {
  id: string;
  tournament_id: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  display_name: string | null;
  seed: number | null;
  created_at: string;
  registered_by?: string | null;
  source?: "app" | "organiser" | "form" | null;
  looking_for_partner?: boolean | null;
  updated_at?: string | null;
  player?: { full_name: string | null; gender?: string | null; is_guest?: boolean | null } | null;
  partner?: { full_name: string | null; gender?: string | null; is_guest?: boolean | null } | null;
}

export interface WaitlistRowData {
  id: string;
  tournament_id: string;
  category: string;
  player_id: string;
  partner_id: string | null;
  created_at: string;
}

export type PartnerRequestStatus = "pending" | "accepted" | "declined" | "stale" | "expired";

export interface PartnerRequest {
  id: string;
  tournament_id: string;
  category: string;
  from_player_id: string;
  to_player_id: string;
  status: PartnerRequestStatus;
  stale_reason: string | null;
  created_at: string;
  responded_at: string | null;
  from_player?: { full_name: string | null } | null;
  to_player?: { full_name: string | null } | null;
}

export type WithdrawalStatus = "pending" | "waiting_opponent" | "removed" | "walkover" | "dismissed";

export interface WithdrawalRequest {
  id: string;
  tournament_id: string;
  category: string;
  participant_id: string | null;
  requested_by: string;
  player_ids: string[];
  reason: string | null;
  status: WithdrawalStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface EntryEvent {
  id: string;
  tournament_id: string;
  category: string | null;
  participant_id: string | null;
  actor_id: string | null;
  action: string;
  player_ids: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

/** registration_attention() (snake_case from SQL). */
export interface AttentionResult {
  noPartner: { row_id: string; category: string; player_id: string; looking: boolean }[];
  sharedPartner: { category: string; shared_player_id: string; row_ids: string[]; other_player_ids: (string | null)[] }[];
  partnerNotOnApp: { row_id: string; category: string; partner_id: string }[];
  genderMismatch: { row_id: string; category: string }[];
  genderUnknown: { row_id: string; category: string }[];
}

export type ReminderKind = "no_partner" | "shared_partner" | "all_incomplete";

export interface ReminderSkip {
  player_id: string;
  name: string | null;
  category?: string;
  reason: "reminded_recently" | "not_on_app";
  last_at?: string | null;
  /** not_on_app: a registrationMessages payload for "Copy WhatsApp message". */
  payload?: Record<string, unknown> | null;
}

export interface ReminderResult {
  reminded: number;
  skipped: ReminderSkip[];
  no_email: number;
  refused_categories: string[];
  capped: boolean;
}

export interface ConflictItem {
  category: string;
  shared_player_id: string;
  shared_name: string | null;
  row_ids: string[];
  other_names: (string | null)[];
  first_seen_at: string | null;
}

export interface OrganiserSaveResult {
  status: "saved" | "refused";
  reason?: string;
  participant_id?: string;
  warnings?: { kind: "taken" | "gender" | "events_limit"; player_id?: string; player_name?: string; with_name?: string }[];
}

export interface BackupStats { copied: number; failed: number; pending: number }
