import { selectTargets, type TargetOptions } from "./dispatchRules.ts";
/**
 * The only client surface this helper needs. Typed structurally so callers on
 * any supabase-js version (the functions pin different ones) type-check.
 */
// deno-lint-ignore no-explicit-any
type SupabaseClient = { from: (table: string) => any };

export type PreferenceColumn =
  | "pref_notify_smash"
  | "pref_notify_point"
  | "pref_notify_serve"
  | "pref_notify_whistle"
  | "pref_notify_victory"
  | "pref_notify_gallery"
  | "pref_notify_buddy_status";

/** PostgREST puts `.in()` lists in the URL; keep each request well under its length limit. */
const IN_CHUNK = 100;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += IN_CHUNK) out.push(items.slice(i, i + IN_CHUNK));
  return out;
}

export interface NotificationTargets {
  pushTokens: { user_id: string; token: string }[];
  emails: { user_id: string; email: string; iisc_email: string | null }[];
}

/**
 * Fetches push tokens and emails for the given user IDs, respecting the user's
 * master `pref_receive_push` / `pref_receive_email` toggles AND the specific
 * category preference (e.g., `pref_notify_smash`).
 *
 * @param supabase The admin Supabase client (service_role)
 * @param userIds The recipients to check
 * @param prefColumn The specific category preference to check (e.g. pref_notify_smash)
 */
export async function getNotificationTargets(
  supabase: SupabaseClient,
  userIds: string[],
  prefColumn: PreferenceColumn,
  /** Default = today's behaviour. Registration notices pass { emailIgnoresPrefs: true }. */
  opts: TargetOptions = {},
): Promise<NotificationTargets> {
  if (!userIds || userIds.length === 0) {
    return { pushTokens: [], emails: [] };
  }

  // 1. Fetch player preferences & emails
  const players: any[] = [];
  for (const ids of chunks(userIds)) {
    const { data, error: playersErr } = await supabase
      .from("players")
      .select(`id, email, iisc_email, pref_receive_push, pref_receive_email, ${prefColumn}`)
      .in("id", ids);

    if (playersErr || !data) {
      console.error("[getNotificationTargets] Failed to fetch players:", playersErr);
      return { pushTokens: [], emails: [] };
    }
    players.push(...data);
  }

  // Who gets push / email: the pure rule in dispatchRules.ts (vitest-covered).
  const selected = selectTargets(players, prefColumn, opts);
  const pushEnabledUserIds = new Set<string>(selected.pushUserIds);
  const emailEnabledUsers: NotificationTargets["emails"] = selected.emails.map((e) => ({ ...e, email: e.email ?? "" }));

  // 2. Fetch push tokens ONLY for users who have Push + Category enabled
  const pushTokens: { user_id: string; token: string }[] = [];
  for (const ids of chunks(Array.from(pushEnabledUserIds))) {
    const { data: tokensRows, error: tokensErr } = await supabase
      .from("user_push_tokens")
      .select("user_id, token")
      .in("user_id", ids);

    if (tokensErr) {
      console.error("[getNotificationTargets] Failed to fetch tokens:", tokensErr);
    } else if (tokensRows) {
      pushTokens.push(...tokensRows);
    }
  }

  return { pushTokens, emails: emailEnabledUsers };
}
