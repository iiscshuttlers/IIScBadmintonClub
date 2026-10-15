import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { getNotificationTargets } from "../_shared/notifications.ts";
import { isDeadToken, isFatalSendError } from "../_shared/fcm.ts";
import { computeQueueAlerts, queueAlertText, LIVE_STATUSES, type QueueMatch } from "../_shared/courtQueue.ts";

/**
 * "You're up next" court-queue alerts. Invoked every minute by pg_cron
 * (migration 20261015100000_court_queue_alerts.sql). For every court with a
 * match in progress, tells the players 1 and 2 places down the queue.
 * Each (match, player, position) is alerted at most once — court_queue_alerts.
 * Exits after one cheap query when no tournament match is live.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFirebaseAccessToken(sa: ServiceAccount): Promise<string> {
  try {
    const privateKey = await importPKCS8(sa.private_key, "RS256");
    const jwt = await new SignJWT({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Firebase auth error", data);
      return "";
    }
    return data.access_token;
  } catch (e) {
    console.error("Firebase auth failed", e);
    return "";
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  try {
    // 1. Which tournaments have something live on a court right now?
    const { data: live, error: liveErr } = await supabase
      .from("tournament_matches")
      .select("tournament_id")
      .in("status", Array.from(LIVE_STATUSES))
      .not("court_number", "is", null);
    if (liveErr) throw liveErr;
    const tournamentIds = Array.from(new Set((live ?? []).map((r) => r.tournament_id)));
    if (tournamentIds.length === 0) return json({ success: true, sent: 0, live: 0 });

    // 2. Their open matches on courts → queue alerts.
    const { data: open, error: openErr } = await supabase
      .from("tournament_matches")
      .select(
        "id, tournament_id, court_number, status, scheduled_at, round, match_number, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, category",
      )
      .in("tournament_id", tournamentIds)
      .in("status", [...Array.from(LIVE_STATUSES), "scheduled", "pending"])
      .not("court_number", "is", null);
    if (openErr) throw openErr;

    const alerts = computeQueueAlerts((open ?? []) as QueueMatch[]);
    if (alerts.length === 0) return json({ success: true, sent: 0, live: tournamentIds.length });

    // 3. Dedupe: skip anyone already told about this match at this position or closer.
    const matchIds = Array.from(new Set(alerts.map((a) => a.match.id)));
    const { data: sentRows, error: sentErr } = await supabase
      .from("court_queue_alerts")
      .select("match_id, user_id, position")
      .in("match_id", matchIds);
    if (sentErr) throw sentErr;
    const closest = new Map<string, number>();
    for (const r of sentRows ?? []) {
      const k = `${r.match_id}:${r.user_id}`;
      closest.set(k, Math.min(closest.get(k) ?? Infinity, r.position));
    }

    let sa: ServiceAccount | null = null;
    try {
      sa = FIREBASE_SERVICE_ACCOUNT ? JSON.parse(FIREBASE_SERVICE_ACCOUNT) : null;
    } catch {
      sa = null;
    }
    const accessToken = sa ? await getFirebaseAccessToken(sa) : "";
    let pushDisabled = !accessToken;

    let sent = 0;
    for (const alert of alerts) {
      const recipients = alert.playerIds.filter(
        (uid) => (closest.get(`${alert.match.id}:${uid}`) ?? Infinity) > alert.position,
      );
      if (recipients.length === 0) continue;

      // Claim first so an overlapping run can't double-send.
      const { data: claimed, error: claimErr } = await supabase
        .from("court_queue_alerts")
        .upsert(
          recipients.map((user_id) => ({ match_id: alert.match.id, user_id, position: alert.position })),
          { onConflict: "match_id,user_id,position", ignoreDuplicates: true },
        )
        .select("user_id");
      if (claimErr) {
        console.error("claim failed", claimErr);
        continue;
      }
      const claimedIds = (claimed ?? []).map((r) => r.user_id as string);
      if (claimedIds.length === 0) continue;

      const { title, body } = queueAlertText(alert);
      const link = `/tournaments/${alert.match.tournament_id}`;

      await supabase.from("notifications").insert(
        claimedIds.map((user_id) => ({ user_id, title, message: body, type: "court_queue", link })),
      );
      sent += claimedIds.length;

      if (pushDisabled) continue;
      const { pushTokens } = await getNotificationTargets(supabase, claimedIds, "pref_notify_smash");
      for (const { token } of pushTokens) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa!.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type: "court_queue", action: "view_match", link, match_id: alert.match.id },
              android: { priority: "high", notification: { channel_id: "notify_point" } },
              webpush: { headers: { Urgency: "high" }, notification: { icon: "icon-192.png", badge: "icon-192.png" } },
              apns: { headers: { "apns-priority": "10" } },
            },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          if (isFatalSendError(res.status)) {
            console.error("FCM auth/config failure; stopping push for this run", res.status, text);
            pushDisabled = true;
            break;
          }
          if (isDeadToken(res.status, text)) {
            await supabase.from("user_push_tokens").delete().eq("token", token);
          } else {
            console.error("FCM send failed", res.status, text);
          }
        }
      }
    }

    return json({ success: true, sent, live: tournamentIds.length });
  } catch (error: any) {
    console.error("notify-up-next failed:", error);
    return json({ success: false, error: error?.message ?? String(error) }, 500);
  }
});
