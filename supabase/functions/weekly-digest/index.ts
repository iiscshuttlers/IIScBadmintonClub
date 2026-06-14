import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendFcmToAll(tokens: string[], title: string, body: string) {
  if (!tokens.length) return;
  // FCM multicast (max 1000 per request)
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 1000) {
    chunks.push(tokens.slice(i, i + 1000));
  }
  for (const chunk of chunks) {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: chunk,
        notification: { title, body, sound: "default" },
        android: {
          notification: {
            channel_id: "match_alerts_smash",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
      }),
    });
  }
}

serve(async () => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Get all confirmed matches from the past 7 days
    const { data: matches } = await supabase
      .from("matches")
      .select("id, winner_id, player1_id, player2_id, elo_change_p1, elo_change_p2, created_at")
      .eq("status", "confirmed")
      .gte("created_at", since);

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No matches this week." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Compute stats
    const totalMatches = matches.length;

    // Most active player (most matches)
    const matchCounts: Record<string, number> = {};
    for (const m of matches) {
      matchCounts[m.player1_id] = (matchCounts[m.player1_id] ?? 0) + 1;
      matchCounts[m.player2_id] = (matchCounts[m.player2_id] ?? 0) + 1;
    }
    const topPlayerId = Object.entries(matchCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Biggest ELO gainer
    const eloGains: Record<string, number> = {};
    for (const m of matches) {
      if (m.elo_change_p1 != null) eloGains[m.player1_id] = (eloGains[m.player1_id] ?? 0) + m.elo_change_p1;
      if (m.elo_change_p2 != null) eloGains[m.player2_id] = (eloGains[m.player2_id] ?? 0) + m.elo_change_p2;
    }
    const topGainerId = Object.entries(eloGains).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topGain = topGainerId ? eloGains[topGainerId] : 0;

    // Biggest upset: winner gained most ELO (higher gain = more upset)
    const biggestUpset = matches
      .filter(m => m.elo_change_p1 != null && m.elo_change_p2 != null)
      .map(m => ({
        ...m,
        upsetScore: Math.max(m.elo_change_p1 ?? 0, m.elo_change_p2 ?? 0),
      }))
      .sort((a, b) => b.upsetScore - a.upsetScore)[0];

    // 3. Look up player names
    const playerIds = [...new Set([topPlayerId, topGainerId].filter(Boolean))];
    const { data: playerRows } = await supabase
      .from("players")
      .select("id, full_name")
      .in("id", playerIds);
    const nameOf = (id: string) => playerRows?.find(p => p.id === id)?.full_name ?? "Unknown";

    // 4. Build digest message
    const lines = [
      `⚡ ${totalMatches} matches played this week!`,
      topPlayerId ? `🏆 Most active: ${nameOf(topPlayerId)} (${matchCounts[topPlayerId]} matches)` : null,
      topGainerId && topGain > 0 ? `📈 Biggest ELO gain: ${nameOf(topGainerId)} (+${topGain} ELO)` : null,
      biggestUpset && biggestUpset.upsetScore > 20 ? `😱 Biggest upset: +${biggestUpset.upsetScore} ELO won!` : null,
    ].filter(Boolean).join("\n");

    // 5. Post to announcements feed (site_data)
    const digestAnnouncement = {
      title: `📊 Weekly Digest — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
      date: new Date().toISOString(),
      category: "Weekly Digest",
      priority: "normal",
      content: lines,
    };
    const { data: siteDataRow } = await supabase
      .from("site_data")
      .select("value")
      .eq("key", "announcements")
      .maybeSingle();

    const existing = (siteDataRow?.value as any)?.recent ?? [];
    await supabase.from("site_data").upsert({
      key: "announcements",
      value: { recent: [digestAnnouncement, ...existing].slice(0, 50) },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    // 6. Send FCM push to all players with tokens
    const { data: allPlayers } = await supabase
      .from("players")
      .select("fcm_token")
      .not("fcm_token", "is", null)
      .is("deleted_at", null);

    const tokens = (allPlayers ?? []).map(p => p.fcm_token).filter(Boolean) as string[];
    await sendFcmToAll(
      tokens,
      "📊 IISc Shuttlers Weekly Digest",
      `${totalMatches} matches this week! Check the Feed to see who dominated the courts 🏸`
    );

    return new Response(
      JSON.stringify({ success: true, matches: totalMatches, push_sent: tokens.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("weekly-digest error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
