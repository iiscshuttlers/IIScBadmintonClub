import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

export type PreferenceColumn =
  | "pref_notify_smash"
  | "pref_notify_point"
  | "pref_notify_serve"
  | "pref_notify_whistle"
  | "pref_notify_victory";

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
  prefColumn: PreferenceColumn
): Promise<NotificationTargets> {
  if (!userIds || userIds.length === 0) {
    return { pushTokens: [], emails: [] };
  }

  // 1. Fetch player preferences & emails
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select(`id, email, iisc_email, pref_receive_push, pref_receive_email, ${prefColumn}`)
    .in("id", userIds);

  if (playersErr || !players) {
    console.error("[getNotificationTargets] Failed to fetch players:", playersErr);
    return { pushTokens: [], emails: [] };
  }

  // Filter users who opted in to this specific category
  const pushEnabledUserIds = new Set<string>();
  const emailEnabledUsers: NotificationTargets["emails"] = [];

  for (const p of players) {
    // If the category is explicitly disabled, skip both push and email
    const categoryEnabled = p[prefColumn] !== false;
    if (!categoryEnabled) continue;

    // Push explicitly enabled (default is true if null/undefined due to migration)
    if (p.pref_receive_push !== false) {
      pushEnabledUserIds.add(p.id);
    }

    // Email explicitly enabled (default is true)
    if (p.pref_receive_email !== false) {
      if (p.email || p.iisc_email) {
        emailEnabledUsers.push({
          user_id: p.id,
          email: p.email,
          iisc_email: p.iisc_email,
        });
      }
    }
  }

  // 2. Fetch push tokens ONLY for users who have Push + Category enabled
  let pushTokens: { user_id: string; token: string }[] = [];
  if (pushEnabledUserIds.size > 0) {
    const { data: tokensRows, error: tokensErr } = await supabase
      .from("user_push_tokens")
      .select("user_id, token")
      .in("user_id", Array.from(pushEnabledUserIds));

    if (tokensErr) {
      console.error("[getNotificationTargets] Failed to fetch tokens:", tokensErr);
    } else if (tokensRows) {
      pushTokens = tokensRows;
    }
  }

  return { pushTokens, emails: emailEnabledUsers };
}
