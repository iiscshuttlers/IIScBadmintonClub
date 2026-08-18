/**
 * Push notification for social events: buddy requests and follows.
 * Called client-side via supabase.functions.invoke("notify-social", { body: {...} }).
 *
 * Body:
 *   type          "buddy_request" | "follow"
 *   to_player_id  players.id of the recipient (not required for status_update)
 *   from_name     display name of the sender
 *   from_player_id players.id of the sender (for deep-link navigation)
 *   new_status    new live status of the sender (only for status_update)
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { isDeadToken } from "../_shared/fcm.ts";

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
            notification: { channel_id: "notify_victory" },
          },
          data,
        },
      }),
    },
  );
  if (res.ok) return { ok: true, stale: false };
  return { ok: false, stale: isDeadToken(res.status, await res.text()) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, to_player_id, from_name, from_player_id, new_status } = await req.json() as {
      type: "buddy_request" | "follow" | "status_update";
      to_player_id?: string;
      from_name: string;
      from_player_id: string;
      new_status?: string;
    };

    if (!type || !from_name || !from_player_id) {
      return new Response(
        JSON.stringify({ error: "type, from_player_id, and from_name are required" }),
        { status: 400, headers: corsHeaders },
      );
    }
    
    if (type !== "status_update" && !to_player_id) {
      return new Response(
        JSON.stringify({ error: "to_player_id is required for this type" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let targetUserIds: string[] = [];

    if (type === "status_update") {
      // Fetch the sender's buddies
      const { data: senderData } = await supabase
        .from("players")
        .select("buddies")
        .eq("id", from_player_id)
        .single();
      
      const buddies = senderData?.buddies || [];
      if (buddies.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_buddies" }), { headers: corsHeaders });
      }

      // Filter buddies who have pref_notify_buddy_status = true
      let buddyPlayers = null;
      const { data, error } = await supabase
        .from("players")
        .select("id")
        .in("id", buddies)
        .neq("pref_notify_buddy_status", false);
        
      if (!error) {
        buddyPlayers = data;
      } else {
        console.warn("[notify-social] Could not filter by pref_notify_buddy_status:", error);
      }
        
      targetUserIds = buddyPlayers ? buddyPlayers.map(p => p.id) : buddies;
      
      if (targetUserIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "all_buddies_muted" }), { headers: corsHeaders });
      }
    } else {
      targetUserIds = [to_player_id!];
    }

    // Determine notification content
    let title = "";
    let body = "";
    let notifType = "";
    if (type === "buddy_request") {
      title = "👋 New Buddy Request";
      body = `${from_name} wants to be your badminton buddy!`;
      notifType = "buddy_request";
    } else if (type === "follow") {
      title = "❤️ New Follower";
      body = `${from_name} started following you.`;
      notifType = "new_follower";
    } else if (type === "status_update") {
      const statusLabel = new_status === "playing" ? "Playing Right Now" : "Looking to play";
      title = "🏸 Buddy Status Update";
      body = `${from_name} is now ${statusLabel}!`;
      notifType = "status_update";
    }

    // Create in-app notifications for all target users
    if (targetUserIds.length > 0) {
      await supabase.from("notifications").insert(
        targetUserIds.map(userId => ({
          user_id: userId,
          title,
          message: body,
          type: notifType,
          link: `/player/${from_player_id}`
        }))
      );
    }

    // to_player_id is now the auth UUID directly
    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), { headers: corsHeaders });
    }

    if (!FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
    }

    const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getFirebaseAccessToken(sa);

    const notifData: Record<string, string> = {
      type: "player_profile",
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
