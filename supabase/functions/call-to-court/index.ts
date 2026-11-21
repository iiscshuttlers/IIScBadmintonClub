import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { courtLabel, LIVE_STATUSES } from "../_shared/courtQueue.ts";

/**
 * "Call to court": an umpire/official taps a button and players get an
 * in-app notification + push ("Court 2 is ready for you").
 * POST { match_id, player_ids? } with the caller's JWT. Only users who pass
 * can_umpire_match() may call.
 *
 * - Without player_ids everyone in the match is called. With player_ids only
 *   those players are ("Call" next to one name, or "Call missing players").
 * - The 90 s repeat limit counts per player: a player called in the last 90 s
 *   is left out; the request fails only when nobody is left.
 * - Players live on another match are never called.
 * - Each call is recorded in court_calls with the players it went to.
 * A call to the whole match also reaches followers through the match-call
 * preferences in the authoritative dispatcher; a call to some players goes to
 * exactly those players.
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(jwt);
    const uid = auth?.user?.id;
    if (!uid) return json({ error: "Sign in required" }, 401);

    const { match_id, player_ids } = await req.json().catch(() => ({}));
    if (typeof match_id !== "string") return json({ error: "match_id required" }, 400);
    if (player_ids !== undefined && (!Array.isArray(player_ids) || player_ids.some((p) => typeof p !== "string" || !UUID_RE.test(p)))) {
      return json({ error: "player_ids must be a list of player ids" }, 400);
    }

    const { data: allowed } = await admin.rpc("can_umpire_match", { p_match_id: match_id, p_uid: uid });
    if (!allowed) return json({ error: "Only this match's officials can call players" }, 403);

    const { data: m, error: mErr } = await admin
      .from("tournament_matches")
      .select("id, tournament_id, match_code, court_number, status, category, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id")
      .eq("id", match_id)
      .maybeSingle();
    if (mErr || !m) return json({ error: "Match not found" }, 404);
    if (m.status === "completed" || m.status === "walkover") return json({ error: "Match is already finished" }, 409);

    const everyone = [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter(Boolean) as string[];
    if (everyone.length === 0) return json({ success: true, notified: 0 });
    const requested: string[] = Array.isArray(player_ids)
      ? everyone.filter((p) => (player_ids as string[]).includes(p))
      : everyone;
    if (requested.length === 0) return json({ error: "Those players aren't in this match" }, 400);

    // Players live on another match of this tournament can't come now.
    const { data: liveRows, error: liveErr } = await admin
      .from("tournament_matches")
      .select("id, player1_id, player2_id, player3_id, player4_id")
      .eq("tournament_id", m.tournament_id)
      .neq("id", match_id)
      .in("status", Array.from(LIVE_STATUSES));
    if (liveErr) throw liveErr;
    const busy = new Set<string>();
    for (const r of liveRows ?? []) for (const p of [r.player1_id, r.player2_id, r.player3_id, r.player4_id]) if (p) busy.add(p);

    // Per-player cooldown: anyone called in the last 90 s is left out.
    const { data: recent, error: recentErr } = await admin
      .from("court_calls")
      .select("called_at, player_ids")
      .eq("match_id", match_id)
      .gte("called_at", new Date(Date.now() - COOLDOWN_MS).toISOString());
    if (recentErr) throw recentErr;
    const coolingDown = new Set<string>();
    for (const c of recent ?? []) for (const p of (c.player_ids as string[] | null) ?? everyone) coolingDown.add(p);

    const onCourt = requested.filter((p) => busy.has(p));
    const cooling = requested.filter((p) => !busy.has(p) && coolingDown.has(p));
    const targets = requested.filter((p) => !busy.has(p) && !coolingDown.has(p));
    if (targets.length === 0) {
      if (cooling.length > 0) {
        return json({ error: "Players were just called — wait a minute before calling again", cooldown: true, on_court: onCourt }, 429);
      }
      return json({ error: "They're playing on another court right now", on_court: onCourt }, 409);
    }

    const { data: call, error: callError } = await admin
      .from("court_calls")
      .insert({ match_id, called_by: uid, player_ids: targets })
      .select("called_at")
      .single();
    if (callError || !call) throw callError ?? new Error("Failed to record court call");

    const where = m.court_number ? courtLabel(String(m.court_number)) : null;
    const wholeMatch = targets.length === everyone.length;
    let title: string;
    let body: string;
    if (wholeMatch) {
      title = `📣 ${where ?? "Your court"} is ready for you`;
      body = `${m.category ? m.category + " · " : ""}${m.team1_label || "Side 1"} vs ${m.team2_label || "Side 2"} — please come to the court now.`;
    } else {
      // Is everyone we're not calling already here?
      const others = everyone.filter((p) => !targets.includes(p));
      const { data: rows } = await admin
        .from("tournament_checkins")
        .select("player_id, state, break_until, expires_at")
        .eq("tournament_id", m.tournament_id)
        .in("player_id", others.length ? others : ["00000000-0000-0000-0000-000000000000"]);
      const now = Date.now();
      const presentIds = new Set(
        (rows ?? [])
          .filter((r) => Date.parse(r.expires_at) > now && (r.state === "here" || (r.break_until && Date.parse(r.break_until) <= now)))
          .map((r) => r.player_id as string),
      );
      const othersHere = others.every((p) => presentIds.has(p) && !busy.has(p));
      title = `📣 You're needed for ${m.match_code || "your match"}${where ? ` on ${where}` : ""}`;
      body = othersHere ? "Everyone else is here." : "Please come to the court now.";
    }

    const { data: dispatch, error: dispatchError } = await admin.rpc("dispatch_authoritative_match_alert", {
      p_match_id: match_id,
      p_event_type: "match_call",
      p_title: title,
      p_body: body,
      p_version: Date.parse(call.called_at),
      p_recipients: wholeMatch ? null : targets,
    });
    if (dispatchError) throw dispatchError;

    return json({
      success: true,
      notified: Number(dispatch?.delivered_count ?? targets.length),
      skipped: Number(dispatch?.skipped_count ?? 0),
      called: targets,
      on_court: onCourt,
      cooling_down: cooling,
      push_queued: true,
    });
  } catch (e: any) {
    console.error("call-to-court failed", e);
    return json({ error: e?.message ?? "Failed" }, 500);
  }
});
