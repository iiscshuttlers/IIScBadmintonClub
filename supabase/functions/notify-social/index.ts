/**
 * Push notification for social events: buddy requests and follows.
 * Called client-side via supabase.functions.invoke("notify-social", { body: {...} }).
 *
 * Body:
 *   type          "buddy_request" | "follow"
 *   to_player_id  players.id of the recipient
 *   from_name     display name of the sender
 *   from_player_id players.id of the sender (for deep-link navigation)
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFirebaseAccessToken(sa: ServiceAccount): Promise<string> {
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
  if (!res.ok) throw new Error(`OAuth error: ${data.error_description}`);
  return data.access_token as string;
}

async function sendFcm(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
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
        message: {
          token: fcmToken,
          notification: { title, body },
          android: {
            priority: "high",
            notification: { channelId: "notify_friendly" },
          },
          data,
        },
      }),
    },
  );
  return { ok: res.ok, stale: res.status === 404 || res.status === 400 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, to_player_id, from_name, from_player_id } = await req.json() as {
      type: "buddy_request" | "follow";
      to_player_id: string;
      from_name: string;
      from_player_id: string;
    };

    if (!type || !to_player_id || !from_name) {
      return new Response(
        JSON.stringify({ error: "type, to_player_id, and from_name are required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve player TEXT id → auth UUID (user_push_tokens is keyed by auth UUID)
    const { data: recipient, error: recipientError } = await supabase
      .from("players")
      .select("user_id")
      .eq("id", to_player_id)
      .single();

    if (recipientError || !recipient?.user_id) {
      console.warn(`[notify-social] Could not find user_id for player ${to_player_id}`);
      return new Response(JSON.stringify({ sent: 0, reason: "player_not_found" }), { headers: corsHeaders });
    }

    // Fetch FCM tokens for this user
    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("token")
      .eq("user_id", recipient.user_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), { headers: corsHeaders });
    }

    if (!FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
    }

    const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getFirebaseAccessToken(sa);

    const title = type === "buddy_request"
      ? "👋 New Buddy Request"
      : "❤️ New Follower";
    const body = type === "buddy_request"
      ? `${from_name} wants to be your badminton buddy!`
      : `${from_name} started following you.`;
    const notifData: Record<string, string> = {
      type: type === "buddy_request" ? "player_profile" : "player_profile",
      player_id: from_player_id ?? "",
    };

    let sent = 0;
    const staleTokens: string[] = [];

    for (const { token } of tokens) {
      const { ok, stale } = await sendFcm(token as string, title, body, notifData, sa.project_id, accessToken);
      if (ok) sent++;
      if (stale) staleTokens.push(token as string);
    }

    // Clean up stale tokens
    for (const staleToken of staleTokens) {
      await supabase.from("user_push_tokens").delete().eq("token", staleToken);
    }

    console.log(`[notify-social] type=${type} to=${to_player_id} sent=${sent} stale=${staleTokens.length}`);
    return new Response(JSON.stringify({ sent }), { headers: corsHeaders });
  } catch (err) {
    console.error("[notify-social] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
