import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { isDeadToken } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, expires",
};

async function getFirebaseAccessToken(): Promise<string> {
  const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountStr) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
  const serviceAccount = JSON.parse(serviceAccountStr);
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

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth error: ${data.error_description}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, body, admin_email, data_type, data_action } = await req.json() as { title: string; body: string; admin_email?: string; data_type?: string; data_action?: string };
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Create in-app notifications for ALL users (regardless of push token status)
    console.log("Fetching all players...");
    const { data: allUsers, error: usersErr } = await supabase
      .from("players")
      .select("id");

    console.log(`Players fetched: ${allUsers?.length || 0}, Error: ${usersErr?.message || "none"}`);
    if (usersErr) throw new Error(`Failed to fetch players: ${usersErr.message}`);

    if (allUsers && allUsers.length > 0) {
      console.log(`Creating notifications for ${allUsers.length} users...`);
      const { error: notifErr } = await supabase.from("notifications").insert(
        allUsers.map((u: any) => ({
          user_id: u.id,
          title: `📢 ${title}`,
          message: body,
          type: data_type || "announcement",
          link: data_type === "app_update" ? "https://play.google.com/store/apps/details?id=shuttlers.iisc.com" : "/pulse#announcements"
        }))
      );
      console.log(`Notifications insert result: ${notifErr?.message || "success"}`);
      if (notifErr) throw new Error(`Failed to insert notifications: ${notifErr.message}`);
    } else {
      console.log("No players found!");
    }

    // Fetch all push tokens for Firebase push notifications
    const { data: tokens, error: tokErr } = await supabase
      .from("user_push_tokens")
      .select("token, user_id");

    if (tokErr) throw new Error(tokErr.message);

    // If no push tokens, just return success (in-app notifications are created anyway)
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "Announcement sent (in-app only, no push tokens registered)", sent: 0, failed: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = [...new Set(tokens.map((t) => t.user_id).filter(Boolean))];

    const fcmToken = await getFirebaseAccessToken();
    const projectId = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!).project_id;
    const uniqueTokens = [...new Map(tokens.map((t) => [t.token, t])).values()];

    const results = await Promise.allSettled(
      uniqueTokens.map(async (t) => {
        const payload = {
          message: {
            token: t.token,
            notification: { title: `📢 ${title}`, body },
            data: { type: data_type || "announcement", action: data_action || "view_announcements" },
            android: {
              priority: "high",
              notification: { channel_id: "notify_whistle" }
            },
            webpush: {
              headers: { Urgency: "high" },
              notification: {
                icon: "icon-192.png",
                badge: "icon-192.png",
              },
            },
          },
        };
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmToken}` },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const err = await res.text();
          // Delete only genuinely dead tokens — a bare 400 is normally a bad
          // payload and would otherwise wipe every token in the table.
          if (isDeadToken(res.status, err)) {
            await supabase.from("user_push_tokens").delete().eq("token", t.token);
          }
          throw new Error(`FCM ${res.status}: ${err.slice(0, 100)}`);
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failedResults = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    const failed = failedResults.length;
    const errors = failedResults.map(r => r.reason.message || String(r.reason));

    // Log to admin_logs
    await supabase.from("admin_logs").insert({
      admin_email: admin_email ?? "admin",
      action: "announcement_push_sent",
      details: `"${title}" → ${sent} sent, ${failed} failed. Errors: ${errors.slice(0, 3).join(" | ")}`,
    });

    return new Response(JSON.stringify({ sent, failed, total: uniqueTokens.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
