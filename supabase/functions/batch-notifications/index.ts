/**
 * Smart Notification Batching (#56)
 * Collects queued notifications from the `notification_queue` table,
 * groups them per player into a single digest push, then marks them sent.
 * Intended to run every 15 minutes via a Supabase cron job.
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

async function sendFcm(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string,
): Promise<{ ok: boolean; stale: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token, notification: { title, body } },
      }),
    },
  );
  const stale = res.status === 404 || res.status === 400;
  return { ok: res.ok, stale };
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetch all unsent queued notifications grouped by player
  const { data: queued, error } = await supabase
    .from("notification_queue")
    .select("id, player_id, title, body, created_at")
    .eq("sent", false)
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!queued || queued.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No queued notifications" }));
  }

  // Group by player_id
  const byPlayer = new Map<string, typeof queued>();
  for (const n of queued) {
    const key = n.player_id as string;
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(n);
  }

  const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getFirebaseToken(sa);

  let sentCount = 0;
  const processedIds: string[] = [];
  const staleTokens: string[] = [];

  for (const [playerId, notifs] of byPlayer) {
    // Resolve player_id → user_id (auth UUID)
    const { data: playerRow } = await supabase
      .from("players")
      .select("user_id")
      .eq("id", playerId)
      .single();

    // Fetch player's push tokens by auth user_id
    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("token")
      .eq("user_id", playerRow?.user_id ?? "");

    if (!tokens || tokens.length === 0) {
      // No token — mark as sent anyway to clear queue
      processedIds.push(...notifs.map((n: any) => n.id));
      continue;
    }

    // Build digest title/body
    let title: string;
    let body: string;
    if (notifs.length === 1) {
      title = notifs[0].title as string;
      body = notifs[0].body as string;
    } else {
      title = `${notifs.length} new notifications`;
      body = notifs.map((n: any) => `• ${n.title}`).slice(0, 5).join("\n");
    }

    for (const { token } of tokens) {
      const { ok, stale } = await sendFcm(token as string, title, body, sa.project_id, accessToken);
      if (ok) sentCount++;
      if (stale) staleTokens.push(token as string);
    }

    processedIds.push(...notifs.map((n: any) => n.id));
  }

  // Mark all processed notifications as sent
  if (processedIds.length > 0) {
    await supabase
      .from("notification_queue")
      .update({ sent: true, sent_at: new Date().toISOString() })
      .in("id", processedIds);
  }

  // Remove stale tokens
  for (const staleToken of staleTokens) {
    await supabase.from("user_push_tokens").delete().eq("token", staleToken);
  }

  await supabase.from("admin_logs").insert({
    admin_email: "system:batch-notifications",
    action: "batch_notifications_sent",
    details: { sent: sentCount, players: byPlayer.size, stale_removed: staleTokens.length },
  });

  return new Response(
    JSON.stringify({ sent: sentCount, players: byPlayer.size, stale_removed: staleTokens.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
