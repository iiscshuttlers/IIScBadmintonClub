/**
 * Match Confirmation Nudge (#58)
 * Notifies the opposing player to confirm a match that has been pending
 * for more than 2 hours. Avoids re-nudging within 12 hours.
 * Schedule: every 2 hours via Supabase cron.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

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

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  // Fetch pending matches older than 2 hours
  const { data: pendingMatches, error } = await supabase
    .from("matches")
    .select("id, player1_id, player2_id, match_score, created_at, nudge_sent_at, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
    .eq("status", "pending")
    .lt("created_at", twoHoursAgo)
    .or(`nudge_sent_at.is.null,nudge_sent_at.lt.${twelveHoursAgo}`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!pendingMatches || pendingMatches.length === 0) {
    return new Response(JSON.stringify({ nudged: 0, message: "No pending matches to nudge" }));
  }

  const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getFirebaseToken(sa);

  let nudged = 0;
  const staleTokens: string[] = [];

  for (const match of pendingMatches) {
    const confirmerId = match.player2_id as string;
    const submitterName = (match.player1 as any)?.full_name ?? "Your opponent";

    // Check player's notify_confirmation preference
    const { data: player } = await supabase
      .from("players")
      .select("notify_confirmation")
      .eq("id", confirmerId)
      .single();

    if (player && player.notify_confirmation === false) continue;

    // Fetch confirmer's push tokens
    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("token")
      .eq("player_id", confirmerId);

    if (!tokens || tokens.length === 0) continue;

    const title = "Match awaiting your confirmation";
    const body = `${submitterName} logged a match. Open the app to confirm or dispute the result.`;

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
              data: { type: "match_confirmation", match_id: match.id as string, tab: "my_matches" },
              android: {
                priority: "high",
                notification: { channelId: "notify_confirmation" }
              },
            },
          }),
        },
      );

      if (res.ok) nudged++;
      if (res.status === 404 || res.status === 400) staleTokens.push(token as string);
    }

    // Update nudge_sent_at to throttle re-nudges
    await supabase
      .from("matches")
      .update({ nudge_sent_at: new Date().toISOString() })
      .eq("id", match.id);
  }

  // Remove stale tokens
  for (const staleToken of staleTokens) {
    await supabase.from("user_push_tokens").delete().eq("token", staleToken);
  }

  await supabase.from("admin_logs").insert({
    admin_email: "system:match-confirmation-nudge",
    action: "match_confirmation_nudges_sent",
    details: { nudged, matches_processed: pendingMatches.length },
  });

  return new Response(
    JSON.stringify({ nudged, matches_processed: pendingMatches.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
