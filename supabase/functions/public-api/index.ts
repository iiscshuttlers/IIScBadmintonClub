/**
 * Public read-only API for IISc Badminton Club
 * Endpoints (all GET, no auth required):
 *   /public-api/leaderboard   → top 20 players by ELO
 *   /public-api/recent-matches → last 20 confirmed matches
 *   /public-api/stats          → aggregate club stats
 *   /public-api/widget         → embeddable HTML snippet
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const html = (body: string) =>
  new Response(body, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/.*\/public-api/, "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // --- /leaderboard ---
  if (path === "/leaderboard" || path === "") {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, elo_rating, stats, avatar_url")
      .eq("is_approved", true)
      .order("elo_rating", { ascending: false })
      .limit(20);
    if (error) return json({ error: error.message }, 500);
    return json({
      generated_at: new Date().toISOString(),
      players: (data ?? []).map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.full_name,
        elo: p.elo_rating ?? 1200,
        wins: p.stats?.wins ?? 0,
        losses: p.stats?.losses ?? 0,
        avatar: p.avatar_url ?? null,
      })),
    });
  }

  // --- /recent-matches ---
  if (path === "/recent-matches") {
    const { data, error } = await supabase
      .from("matches")
      .select("id, match_score, created_at, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return json({ error: error.message }, 500);
    return json({
      generated_at: new Date().toISOString(),
      matches: (data ?? []).map((m: any) => ({
        id: m.id,
        score: m.match_score?.split("[")[0]?.trim() ?? "",
        player1: m.player1?.full_name ?? "Unknown",
        player2: m.player2?.full_name ?? "Unknown",
        played_at: m.created_at,
      })),
    });
  }

  // --- /stats ---
  if (path === "/stats") {
    const [playersRes, matchesRes] = await Promise.all([
      supabase.from("players").select("id", { count: "exact", head: true }).eq("is_approved", true),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    ]);
    return json({
      generated_at: new Date().toISOString(),
      approved_players: playersRes.count ?? 0,
      confirmed_matches: matchesRes.count ?? 0,
    });
  }

  // --- /widget ---
  if (path === "/widget") {
    const { data } = await supabase
      .from("players")
      .select("full_name, elo_rating")
      .eq("is_approved", true)
      .order("elo_rating", { ascending: false })
      .limit(5);

    const rows = (data ?? [])
      .map((p, i) => `<tr><td>${i + 1}</td><td>${p.full_name}</td><td>${p.elo_rating ?? 1200}</td></tr>`)
      .join("");

    return html(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 12px; background: #f8fafc; }
  h3 { margin: 0 0 8px; font-size: 13px; color: #059669; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 4px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  th { font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 10px; }
  a { color: #059669; font-size: 10px; }
</style>
</head>
<body>
<h3>🏸 IISc Badminton Club — Top 5</h3>
<table>
<thead><tr><th>#</th><th>Player</th><th>ELO</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<a href="https://iiscshuttlers.com" target="_blank">View full leaderboard →</a>
</body>
</html>`);
  }

  return json({ error: "Not found", endpoints: ["/leaderboard", "/recent-matches", "/stats", "/widget"] }, 404);
});
