import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getFirebaseAccessToken(): Promise<string> {
  const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { title, body, admin_email } = await req.json() as { title: string; body: string; admin_email?: string };
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch all push tokens
    const { data: tokens, error: tokErr } = await supabase
      .from("user_push_tokens")
      .select("token");

    if (tokErr) throw new Error(tokErr.message);
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No push tokens registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmToken = await getFirebaseAccessToken();
    const projectId = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!).project_id;
    const uniqueTokens = [...new Map(tokens.map((t) => [t.token, t])).values()];

    const results = await Promise.allSettled(
      uniqueTokens.map(async (t) => {
        const payload = {
          message: {
            token: t.token,
            notification: { title: `📢 ${title}`, body },
            data: { action: "view_announcements" },
            android: {
              priority: "normal",
              notification: { channelId: "notify_announcements" }
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
          if (res.status === 404 || res.status === 400) {
            await supabase.from("user_push_tokens").delete().eq("token", t.token);
          }
          throw new Error(err);
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Log to admin_logs
    await supabase.from("admin_logs").insert({
      admin_email: admin_email ?? "admin",
      action: "announcement_push_sent",
      details: `"${title}" → ${sent} sent, ${failed} failed`,
    });

    return new Response(JSON.stringify({ sent, failed, total: uniqueTokens.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
