import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { matchId } = await req.json();
    if (!matchId) throw new Error("matchId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch match data
    const [
      { data: match },
      { data: health },
      { data: sensor },
      { data: rallies }
    ] = await Promise.all([
      supabase.from("matches").select("*, player1:players!player1_id(name), player2:players!player2_id(name)").eq("id", matchId).single(),
      supabase.from("match_health_data").select("*").eq("match_id", matchId).limit(1).maybeSingle(),
      supabase.from("match_sensor_analytics").select("*").eq("match_id", matchId).limit(1).maybeSingle(),
      supabase.from("match_rally_stats").select("*").eq("match_id", matchId)
    ]);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!openaiKey) {
      // Graceful fallback for local testing without an API key
      return new Response(JSON.stringify({ 
        insights: `**AI Analysis (Mocked)**\n\nIt looks like you played a tough match! I noticed you had an average heart rate of ${health?.hr_avg || "N/A"} BPM. Your rallies lasted on average ${rallies?.length ? (rallies.reduce((acc: number, r: any) => acc + r.duration_ms, 0) / rallies.length / 1000).toFixed(1) : "N/A"} seconds.\n\n*Please set OPENAI_API_KEY in Supabase secrets to generate real insights.*` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an elite badminton coach analyzing a match.
Match Info: ${match?.player1?.name?.name || "Player 1"} vs ${match?.player2?.name?.name || "Player 2"} (Score: ${match?.match_score})
Watch Health Data: ${JSON.stringify(health)}
Sensor Data: ${JSON.stringify(sensor)}
Rallies: ${rallies?.length} total rallies.

Give a concise, 2-3 paragraph coaching summary focusing on how their physical exertion (heart rate/stamina) correlated with their performance. Use Markdown.`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an elite badminton coach." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      })
    });

    const openAiJson = await openAiRes.json();
    const insights = openAiJson.choices?.[0]?.message?.content || "No insights could be generated.";

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
