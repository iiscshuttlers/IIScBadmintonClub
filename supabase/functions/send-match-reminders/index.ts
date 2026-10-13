import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { getNotificationTargets } from "../_shared/notifications.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// How long after a reminder's trigger time we may still fire it. Should be >=
// the cron interval so a reminder is never missed between runs.
const CATCHUP_WINDOW_MS = 15 * 60 * 1000;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFirebaseAccessToken(): Promise<string> {
  if (!FIREBASE_SERVICE_ACCOUNT) return "";
  try {
    const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");

    const jwt = await new SignJWT({
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Firebase auth error", data);
      return "";
    }
    return data.access_token;
  } catch (e) {
    console.error("Firebase Auth Parsing Error", e);
    return "";
  }
}

async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string,
  link = "/my-matches",
) {
  if (!accessToken) return;
  await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { type: "match_reminder", action: "view_match", link },
        android: { priority: "high", notification: { channel_id: "notify_point" } },
        webpush: {
          headers: { Urgency: "high" },
          notification: { icon: "icon-192.png", badge: "icon-192.png" },
        },
        apns: { headers: { "apns-priority": "10" } },
      },
    }),
  });
}

function istTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

serve(async () => {
  try {
    const accessToken = await getFirebaseAccessToken();
    let serviceAccount: ServiceAccount | null = null;
    if (FIREBASE_SERVICE_ACCOUNT) {
      try { serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT); } catch (_e) { /* ignore */ }
    }
    const canPush = !!(accessToken && serviceAccount);

    const now = Date.now();

    // Upcoming TOURNAMENT matches within the next 24h that have a scheduled time
    // and have not started yet. (The app logs tournament matches only.)
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from("tournament_matches")
      .select("id, scheduled_at, player1_id, player2_id, player3_id, player4_id, category, team1_label, team2_label, court_number, status")
      .in("status", ["scheduled", "pending"])
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", new Date(now).toISOString())
      .lt("scheduled_at", new Date(now + 24 * 60 * 60 * 1000).toISOString());

    if (matchesError) throw matchesError;

    let sentCount = 0;

    // Deliver one reminder: in-app row (always) + push (pref-gated). Tracks
    // which users were already handled for this match in this run so a user who
    // is both a participant and a subscriber is never notified twice.
    const deliver = async (
      userId: string,
      title: string,
      body: string,
      type: string,
      notifiedThisMatch: Set<string>,
    ) => {
      if (notifiedThisMatch.has(userId)) return false;
      notifiedThisMatch.add(userId);

      // In-app notification (baseline channel — always recorded)
      await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message: body,
        type,
        link: "/my-matches",
      });

      // Push — respects the user's master push toggle + category pref
      if (canPush) {
        const { pushTokens } = await getNotificationTargets(supabase, [userId], "pref_notify_smash");
        const uniqueTokens = Array.from(new Set((pushTokens || []).map((t: any) => t.token)));
        for (const token of uniqueTokens) {
          await sendFcmNotification(token as string, title, body, serviceAccount!.project_id, accessToken, "/my-matches");
        }
      }
      return true;
    };

    for (const match of (upcomingMatches || [])) {
      const matchTime = new Date(match.scheduled_at).getTime();
      const isDue = (leadMins: number) => {
        const triggerTime = matchTime - leadMins * 60 * 1000;
        return now >= triggerTime && now - triggerTime < CATCHUP_WINDOW_MS;
      };
      const notifiedThisMatch = new Set<string>();
      const vs = `${match.team1_label || "Team 1"} vs ${match.team2_label || "Team 2"}`;
      const timeStr = istTime(match.scheduled_at);
      const courtStr = match.court_number ? ` on Court ${match.court_number}` : "";

      const participantIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean) as string[];

      // ── 1. Participants — reminder about YOUR OWN match ──
      for (const playerId of participantIds) {
        // Per-match override wins; else the player's global default.
        const { data: override } = await supabase
          .from("match_reminders")
          .select("remind_before_mins, sent_at")
          .eq("match_id", match.id)
          .eq("user_id", playerId)
          .maybeSingle();

        let leadMins: number | null = null;
        if (override) {
          if (override.sent_at) continue; // already sent
          leadMins = override.remind_before_mins;
        } else {
          const { data: profile } = await supabase
            .from("players")
            .select("default_match_reminder_mins")
            .eq("id", playerId)
            .maybeSingle();
          if (profile?.default_match_reminder_mins) leadMins = profile.default_match_reminder_mins;
        }

        if (leadMins !== null && isDue(leadMins)) {
          const ok = await deliver(
            playerId,
            "🏸 Your match is coming up",
            `${vs} at ${timeStr} IST${courtStr}. Get ready!`,
            "match_reminder",
            notifiedThisMatch,
          );
          if (ok) sentCount++;
          // Mark sent so it never repeats, regardless of override/default source.
          await supabase.from("match_reminders").upsert(
            { match_id: match.id, user_id: playerId, remind_before_mins: leadMins, sent_at: new Date().toISOString() },
            { onConflict: "match_id,user_id" },
          );
        }
      }

      // ── 2. Player subscribers — someone you follow is about to play ──
      if (participantIds.length > 0) {
        const { data: playerSubs } = await supabase
          .from("user_player_subscriptions")
          .select("user_id, player_id, notify_before_mins, players!user_player_subscriptions_player_id_fkey(full_name)")
          .in("player_id", participantIds);

        for (const sub of (playerSubs || [])) {
          // Don't ping someone about their own match here — handled above.
          if (participantIds.includes(sub.user_id)) continue;
          if (!isDue(sub.notify_before_mins)) continue;

          const { data: already } = await supabase
            .from("sent_fan_notifications")
            .select("user_id")
            .eq("match_id", match.id)
            .eq("user_id", sub.user_id)
            .maybeSingle();
          if (already) continue;

          const who = (sub as any).players?.full_name || "A player you follow";
          const ok = await deliver(
            sub.user_id,
            "🏸 A player you follow is about to play",
            `${who} plays at ${timeStr} IST${courtStr} — ${vs}`,
            "friend_match_reminder",
            notifiedThisMatch,
          );
          if (ok) sentCount++;
          await supabase.from("sent_fan_notifications").upsert(
            { match_id: match.id, user_id: sub.user_id },
            { onConflict: "user_id,match_id" },
          );
        }
      }

      // ── 3. Specific-match subscribers — alert for THIS match ──
      const { data: matchSubs } = await supabase
        .from("user_match_notifications")
        .select("user_id, notify_before_mins")
        .eq("match_id", match.id);

      for (const alert of (matchSubs || [])) {
        if (participantIds.includes(alert.user_id)) continue; // own match handled above
        if (!isDue(alert.notify_before_mins)) continue;

        const { data: already } = await supabase
          .from("sent_fan_notifications")
          .select("user_id")
          .eq("match_id", match.id)
          .eq("user_id", alert.user_id)
          .maybeSingle();
        if (already) continue;

        const ok = await deliver(
          alert.user_id,
          "🏸 Match starting soon",
          `${vs} is starting at ${timeStr} IST${courtStr}!`,
          "friend_match_reminder",
          notifiedThisMatch,
        );
        if (ok) sentCount++;
        await supabase.from("sent_fan_notifications").upsert(
          { match_id: match.id, user_id: alert.user_id },
          { onConflict: "user_id,match_id" },
        );
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-match-reminders:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
