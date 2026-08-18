/**
 * Push notification when someone gives kudos on a match (#35).
 * Called client-side via supabase.functions.invoke("notify-kudos", ...).
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { match_id, giver_name } = await req.json() as { match_id: string; giver_name: string };

  if (!match_id) {
    return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetch winner of the match
  const { data: match } = await supabase
    .from("matches")
    .select("winner_id, player1:players!player1_id(full_name), player2:players!player2_id(full_name), match_score")
    .eq("id", match_id)
    .single();

  if (!match?.winner_id) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });
  }

  const winnerId = match.winner_id as string;

  // Check notify preference
  const { data: winner } = await supabase
    .from("players")
    .select("notify_friendly")
    .eq("id", winnerId)
    .single();

  if (winner?.notify_friendly === false) {
    return new Response(JSON.stringify({ sent: 0, reason: "opted_out" }), { headers: corsHeaders });
  }

  // Create in-app notification
  const notifTitle = "Someone liked your match! ❤️";
  const notifBody = `${giver_name} gave kudos on your match.`;

  await supabase.from("notifications").insert({
    user_id: winnerId,
    title: notifTitle,
    message: notifBody,
    type: "kudos",
    link: "/my-matches"
  });

  // Fetch winner's push tokens
  const { data: tokens } = await supabase
    .from("user_push_tokens")
    .select("token")
    .eq("user_id", winnerId);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), { headers: corsHeaders });
  }

  const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getFirebaseToken(sa);

  const title = "Someone liked your match! ❤️";
  const body = `${giver_name} gave kudos on your match.`;
  const staleTokens: string[] = [];
  let sent = 0;

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
            data: { type: "kudos", match_id },
            android: {
              priority: "high",
              notification: { channel_id: "notify_victory" }
            },
          },
        }),
      },
    );
    if (res.ok) sent++;
    else if (isDeadToken(res.status, await res.text())) staleTokens.push(token as string);
  }

  for (const staleToken of staleTokens) {
    await supabase.from("user_push_tokens").delete().eq("token", staleToken);
  }

  return new Response(JSON.stringify({ sent }), { headers: corsHeaders });
});
