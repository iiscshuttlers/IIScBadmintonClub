/**
 * Challenge Expiry Reminders (#57)
 * Runs Sunday evening to notify players about incomplete weekly challenges
 * with progress > 0 but not yet completed. Push them to finish before midnight.
 * Schedule: every Sunday at 20:00 IST (14:30 UTC) via Supabase cron.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { isDeadToken } from "../_shared/fcm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFirebaseToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  }));

  const pemKey = sa.private_key.replace(/\\n/g, "\n");
  const binaryKey = Uint8Array.from(
    atob(pemKey.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")),
    (c) => c.charCodeAt(0),
  );
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );

  const sigInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(sigInput),
  );
  const jwt = `${sigInput}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Current week start (Sunday)
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const weekStart = sunday.toISOString().slice(0, 10);

  // Find players with in-progress (progress > 0, not completed) challenges this week
  const { data: inProgress, error } = await supabase
    .from("challenge_progress")
    .select("player_id, progress, completed, challenge:weekly_challenges(title, target, points, week_start)")
    .eq("completed", false)
    .gt("progress", 0);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Filter to current week only
  const thisWeek = (inProgress ?? []).filter(
    (p: any) => p.challenge?.week_start === weekStart,
  );

  if (thisWeek.length === 0) {
    return new Response(JSON.stringify({ notified: 0, message: "No in-progress challenges" }));
  }

  const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getFirebaseToken(sa);

  let notified = 0;
  const staleTokens: string[] = [];

  // Group by player_id to send one digest per player
  const byPlayer = new Map<string, typeof thisWeek>();
  for (const p of thisWeek) {
    const pid = p.player_id as string;
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid)!.push(p);
  }

  for (const [playerId, challenges] of byPlayer) {
    // Create in-app notification
    const challengeList = challenges
      .map((c: any) => `${c.challenge.title} (${c.progress}/${c.challenge.target})`)
      .join(", ");

    const notifTitle = "⏰ Challenges expire tonight!";
    const notifBody = challenges.length === 1
      ? `You're close! Finish "${challenges[0].challenge.title}" before midnight.`
      : `${challenges.length} challenges in progress: ${challengeList}`;

    await supabase.from("notifications").insert({
      user_id: playerId,
      title: notifTitle,
      message: notifBody,
      type: "challenge_expiry",
      link: "/my-matches"
    });

    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("token")
      .eq("user_id", playerId);

    if (!tokens || tokens.length === 0) continue;

    // Check player's notify_announcements preference (reuse for challenge reminders)
    const { data: player } = await supabase
      .from("players")
      .select("notify_challenges")
      .eq("id", playerId)
      .single();

    if (player && player.notify_challenges === false) continue;

    const title = notifTitle;
    const body = notifBody;

    for (const { token } of tokens) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type: "challenge_expiry", tab: "challenges" },
              android: {
                priority: "high",
                notification: { channel_id: "notify_serve" }
              },
            },
          }),
        },
      );

      if (res.ok) notified++;
      else if (isDeadToken(res.status, await res.text())) staleTokens.push(token as string);
    }
  }

  // Remove stale tokens
  for (const staleToken of staleTokens) {
    await supabase.from("user_push_tokens").delete().eq("token", staleToken);
  }

  await supabase.from("admin_logs").insert({
    admin_email: "system:challenge-expiry-reminders",
    action: "challenge_expiry_reminders_sent",
    details: { notified, players: byPlayer.size, week_start: weekStart },
  });

  return new Response(
    JSON.stringify({ notified, players: byPlayer.size, week_start: weekStart }),
    { headers: { "Content-Type": "application/json" } },
  );
});
