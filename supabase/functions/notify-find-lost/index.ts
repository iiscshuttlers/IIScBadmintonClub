import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

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
  if (!res.ok) {
    throw new Error(`Firebase token error: ${data.error_description}`);
  }
  return data.access_token;
}

async function sendFcm(
  token: string,
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
          token,
          notification: { title, body },
          android: {
            priority: "high",
            notification: { channel_id: "notify_whistle" },
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
    const { type, title, author_name, author_id } = await req.json() as {
      type: "lost" | "found";
      title: string;
      author_name: string;
      author_id: string;
    };

    if (!type || !title || !author_name || !author_id) {
      return new Response(
        JSON.stringify({ error: "type, title, author_name, and author_id are required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch players to check notification preference
    // If pref_notify_find_lost doesn't exist, this fails, so we catch it
    let targetUserIds: string[] | null = null;
    const { data: optInPlayers, error: prefError } = await supabase
      .from("players")
      .select("id")
      .neq("id", author_id)
      .neq("pref_notify_find_lost", false); // treat null/true as opt-in

    if (!prefError && optInPlayers) {
      targetUserIds = optInPlayers.map(p => p.id);
    } else {
      console.warn("[notify-find-lost] Could not filter by pref_notify_find_lost, broadcasting to everyone except author:", prefError);
    }

    // Determine notification message
    const notifTitle = type === "lost" ? "🔍 Item Lost" : "✅ Item Found";
    const notifBody = type === "lost"
      ? `${author_name} posted a lost item: ${title}`
      : `${author_name} posted a found item: ${title}`;

    // Create in-app notifications for all target users
    const notifRecipients = targetUserIds ||
      (await supabase.from("players").select("id")).data?.map(p => p.id) || [];

    const filteredRecipients = notifRecipients.filter(id => id !== author_id);
    if (filteredRecipients.length > 0) {
      await supabase.from("notifications").insert(
        filteredRecipients.map(userId => ({
          user_id: userId,
          title: notifTitle,
          message: notifBody,
          type: "find_lost",
          link: "/hub?tab=lost-found"
        }))
      );
    }

    // Fetch tokens
    let tokensQuery = supabase.from("user_push_tokens").select("token, user_id").neq("user_id", author_id);
    if (targetUserIds) {
      tokensQuery = tokensQuery.in("user_id", targetUserIds);
    }

    const { data: tokens } = await tokensQuery;

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), { headers: corsHeaders });
    }

    if (!FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
    }

    const sa: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getFirebaseAccessToken(sa);

    const notifData: Record<string, string> = {
      action: "view_find_lost",
      type: "find_lost_post"
    };

    let sent = 0;
    const staleTokens: string[] = [];
    
    // Deduplicate tokens
    const uniqueTokens = [...new Set(tokens.map((t) => t.token as string))];

    for (const token of uniqueTokens) {
      const { ok, stale } = await sendFcm(token, notifTitle, notifBody, notifData, sa.project_id, accessToken);
      if (ok) sent++;
      if (stale) staleTokens.push(token);
    }

    // Clean up stale tokens
    for (const staleToken of staleTokens) {
      await supabase.from("user_push_tokens").delete().eq("token", staleToken);
    }

    console.log(`[notify-find-lost] sent=${sent} stale=${staleTokens.length}`);
    return new Response(JSON.stringify({ sent }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("[notify-find-lost] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
