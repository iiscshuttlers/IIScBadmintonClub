import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { isDeadToken, isFatalSendError } from "../_shared/fcm.ts";
import { courtLabel } from "../_shared/courtQueue.ts";

/**
 * "Call to court": an umpire/official taps a button and both sides of a match
 * get an in-app notification + push ("Court 2 is ready for you").
 * POST { match_id } with the caller's JWT. Only users who pass
 * can_umpire_match() may call; one call per match per 90 s.
 * Not gated by notification prefs — it's an operational call, like a PA system.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";
const COOLDOWN_MS = 90_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function fcmToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  return res.ok ? data.access_token : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "Sign in required" }, 401);

    const { match_id } = await req.json().catch(() => ({}));
    if (typeof match_id !== "string") return json({ error: "match_id required" }, 400);

    const { data: allowed } = await admin.rpc("can_umpire_match", { p_match_id: match_id, p_uid: uid });
    if (!allowed) return json({ error: "Only this match's officials can call players" }, 403);

    const { data: m, error: mErr } = await admin
      .from("tournament_matches")
      .select("id, tournament_id, court_number, status, category, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id")
      .eq("id", match_id)
      .maybeSingle();
    if (mErr || !m) return json({ error: "Match not found" }, 404);
    if (m.status === "completed" || m.status === "walkover") return json({ error: "Match is already finished" }, 409);

    // Cooldown so repeated taps don't spam players.
    const { data: last } = await admin
      .from("court_calls")
      .select("called_at")
      .eq("match_id", match_id)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - Date.parse(last.called_at) < COOLDOWN_MS) {
      return json({ error: "Players were just called — wait a minute before calling again", cooldown: true }, 429);
    }
    await admin.from("court_calls").insert({ match_id, called_by: uid });

    const recipients = [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean) as string[];
    if (recipients.length === 0) return json({ success: true, notified: 0 });

    const where = m.court_number ? courtLabel(String(m.court_number)) : "Your court";
    const title = `📣 ${where} is ready for you`;
    const body = `${m.category ? m.category + " · " : ""}${m.team1_label || "Side 1"} vs ${m.team2_label || "Side 2"} — please come to the court now.`;
    const link = `/tournaments/${m.tournament_id}`;

    await admin.from("notifications").insert(
      recipients.map((user_id) => ({ user_id, title, message: body, type: "court_call", link })),
    );

    let pushed = 0;
    let sa: any = null;
    try {
      sa = FIREBASE_SERVICE_ACCOUNT ? JSON.parse(FIREBASE_SERVICE_ACCOUNT) : null;
    } catch {
      sa = null;
    }
    const access = sa ? await fcmToken(sa) : "";
    if (access) {
      const { data: tokens } = await admin.from("user_push_tokens").select("token").in("user_id", recipients);
      for (const { token } of tokens ?? []) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type: "court_call", link, match_id },
              android: { priority: "high", notification: { channel_id: "notify_point" } },
              webpush: { headers: { Urgency: "high" } },
              apns: { headers: { "apns-priority": "10" } },
            },
          }),
        });
        if (res.ok) {
          pushed++;
          continue;
        }
        const text = await res.text();
        if (isFatalSendError(res.status)) break;
        if (isDeadToken(res.status, text)) await admin.from("user_push_tokens").delete().eq("token", token);
      }
    }
    return json({ success: true, notified: recipients.length, pushed });
  } catch (e: any) {
    console.error("call-to-court failed", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
