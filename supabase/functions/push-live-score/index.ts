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
    const { message, match_id, title } = await req.json() as { message: string; match_id?: string; title?: string };
    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: tokens, error: tokErr } = await supabase
      .from("user_push_tokens")
      .select("token, user_id");

    if (tokErr) throw new Error(tokErr.message);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No push tokens registered", sent: 0, failed: 0, total: 0 }), {
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
            notification: { title: title || "🏸 Live Match Score", body: message },
            data: { type: "live_score", action: "view_live_score", match_id: match_id ?? "" },
            android: {
              priority: "high",
              notification: { channel_id: "notify_whistle" }
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

    return new Response(JSON.stringify({ sent, failed, total: uniqueTokens.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
