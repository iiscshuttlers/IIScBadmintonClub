import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { courtLabel } from "../_shared/courtQueue.ts";

/**
 * "Call to court": an umpire/official taps a button and both sides of a match
 * get an in-app notification + push ("Court 2 is ready for you").
 * POST { match_id } with the caller's JWT. Only users who pass
 * can_umpire_match() may call; one call per match per 90 s.
 * Direct participants are always candidates; followers are filtered by their
 * match-call preferences in the authoritative dispatcher.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COOLDOWN_MS = 90_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    const { data: call, error: callError } = await admin
      .from("court_calls")
      .insert({ match_id, called_by: uid })
      .select("called_at")
      .single();
    if (callError || !call) throw callError ?? new Error("Failed to record court call");

    const recipients = [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean) as string[];
    if (recipients.length === 0) return json({ success: true, notified: 0 });

    const where = m.court_number ? courtLabel(String(m.court_number)) : "Your court";
    const title = `📣 ${where} is ready for you`;
    const body = `${m.category ? m.category + " · " : ""}${m.team1_label || "Side 1"} vs ${m.team2_label || "Side 2"} — please come to the court now.`;
    const { data: dispatch, error: dispatchError } = await admin.rpc(
      "dispatch_authoritative_match_alert",
      {
        p_match_id: match_id,
        p_event_type: "match_call",
        p_title: title,
        p_body: body,
        p_version: Date.parse(call.called_at),
      },
    );
    if (dispatchError) throw dispatchError;

    return json({
      success: true,
      notified: Number(dispatch?.delivered_count ?? recipients.length),
      skipped: Number(dispatch?.skipped_count ?? 0),
      push_queued: true,
    });
  } catch (e: any) {
    console.error("call-to-court failed", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
