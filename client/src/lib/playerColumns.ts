/**
 * Player columns anyone may read (anon + members). The private columns
 * (`email`, `iisc_email`, `contact_number`, `sr_number`) are not granted to
 * client roles — see migration 20261113180000_restrict_player_contact_columns.
 * Never select every column of `players` (directly or in an embed): it requests the
 * private columns and the database rejects the whole query.
 *
 * Private data is available only through `services/playerPrivateService`.
 */
export const PLAYER_PRIVATE_COLUMNS = ["email", "iisc_email", "contact_number", "sr_number"] as const;

// A single string literal so supabase-js can type the selected row.
export const PLAYER_PUBLIC_COLUMNS =
  "id, full_name, nickname, avatar_url, department, joined_year, playing_level, dominant_hand, playing_style, favorite_shot, favorite_idol, quote, current_racket, nationality, home_state, height, started_playing_year, coach, bio, current_ranking, highest_ranking, shoes, apparel, instagram, racket_details, tournament_history, achievements, stats, recent_form, recent_matches, frequent_partners, career_highlights, win_loss_record, created_at, is_approved, pref_notify_buddy_status, singles_elo, doubles_elo, mixed_elo, deleted_at, elo_rating, total_friendly_matches, favorite_format, gender, is_looking_to_play, status, followers, following, buddies, is_guest, created_by, is_retired, role, tournament_elo, tournament_singles_elo, tournament_doubles_elo, tournament_mixed_elo, singles_matches_played, doubles_matches_played, mixed_matches_played, singles_record, doubles_record, mixed_record, default_match_reminder_mins, pref_receive_push, pref_receive_email, pref_notify_smash, pref_notify_point, pref_notify_serve, pref_notify_whistle, pref_notify_victory";

/** Compact identity columns for embeds such as `player:players!fk(${PLAYER_CARD_COLUMNS})`. */
export const PLAYER_CARD_COLUMNS = "id, full_name, nickname, avatar_url, gender, is_guest, elo_rating, singles_elo, doubles_elo, mixed_elo";

/** Guard used by tests: a select string must not request private columns. */
export function selectsPrivatePlayerColumns(select: string): boolean {
  return /(^|[\s,(])\*([\s,)]|$)/.test(select) || PLAYER_PRIVATE_COLUMNS.some((c) => new RegExp(`\\b${c}\\b`).test(select));
}

/**
 * Public columns of other tables whose contact fields are restricted
 * (migration 20261114090000): `tournament_participants.email` and
 * `find_lost_posts.claim_contact` come only from checked RPCs.
 */
export const PARTICIPANT_PUBLIC_COLUMNS =
  "id, tournament_id, category, player_id, partner_id, display_name, seed, created_at, entry_round";

export const FIND_LOST_PUBLIC_COLUMNS =
  "id, created_at, author_id, type, title, description, location, contact, image_urls, resolved, claimed_by_id, claimed_by_name, image_url, updated_at, claimed_at, claim_message, remarks, claim_msg, claim_contact_info";
