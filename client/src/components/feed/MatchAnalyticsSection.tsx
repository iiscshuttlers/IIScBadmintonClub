// @ts-nocheck
import { useState, useEffect } from "react";
import { Brain, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";

interface MatchAnalyticsSectionProps {
  matchId: string;
}

export function StrokeAnalyticsSection({ matchId }: MatchAnalyticsSectionProps) {
  const [loadingStrokes, setLoadingStrokes] = useState(true);
  const [strokes, setStrokes] = useState<any[]>([]);

  useEffect(() => {
    const fetchStrokes = async () => {
      setLoadingStrokes(true);
      try {
        const { data } = await supabase
          .from("match_stroke_analytics")
          .select("*")
          .eq("match_id", matchId);
        setStrokes(data || []);
      } catch (e) {
        console.error("Failed to fetch strokes", e);
      } finally {
        setLoadingStrokes(false);
      }
    };
    fetchStrokes();
  }, [matchId]);

  const smashCount = strokes.filter(s => s.stroke_type === "Smash").length;
  const clearCount = strokes.filter(s => s.stroke_type === "Clear").length;
  const dropCount = strokes.filter(s => s.stroke_type === "Drop").length;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-blue-500" />
        Stroke Breakdown
      </h3>
      
      {loadingStrokes ? (
        <div className="text-xs text-muted-foreground animate-pulse">Loading strokes...</div>
      ) : strokes.length > 0 ? (
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800">
           <div className="text-center">
             <div className="text-xl font-black text-slate-800 dark:text-slate-200">{smashCount}</div>
             <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Smashes</div>
           </div>
           <div className="text-center">
             <div className="text-xl font-black text-slate-800 dark:text-slate-200">{clearCount}</div>
             <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Clears</div>
           </div>
           <div className="text-center">
             <div className="text-xl font-black text-slate-800 dark:text-slate-200">{dropCount}</div>
             <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Drops</div>
           </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
          No stroke data recorded for this match yet.
        </div>
      )}
    </div>
  );
}

export function AICoachInsightsSection({ matchId }: MatchAnalyticsSectionProps) {
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-match-insights", {
        body: { matchId }
      });
      if (error) throw error;
      setInsights(data.insights);
    } catch (e) {
      console.error("Edge function failed, falling back to client-side generation...", e);
      try {
        const { data: match } = await supabase.from("matches").select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)").eq("id", matchId).single();
        const { data: health } = await supabase.from("match_health_data").select("*").eq("match_id", matchId).limit(1).maybeSingle();
        const { data: rallies } = await supabase.from("match_rally_stats").select("*").eq("match_id", matchId);
        const { data: sensor } = await supabase.from("match_sensor_analytics").select("*").eq("match_id", matchId).limit(1).maybeSingle();
        
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("No Gemini key");

        const prompt = `You are an elite badminton coach analyzing a match.
Match Info: ${match?.player1?.full_name || "Player 1"} vs ${match?.player2?.full_name || "Player 2"} (Score: ${match?.match_score})
Watch Health Data: ${JSON.stringify(health || {})}
Sensor Data: ${JSON.stringify(sensor || {})}
Rallies: ${rallies?.length || 0} total rallies.

Give a concise, 2-3 paragraph coaching summary focusing on how their physical exertion (heart rate/stamina) correlated with their performance. Use Markdown.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
            }),
          }
        );

        if (!response.ok) throw new Error("Gemini API failed");
        const json = await response.json();
        const fallbackInsights = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!fallbackInsights) throw new Error("No content generated");
        
        setInsights(fallbackInsights);
      } catch (fallbackError) {
        console.error(fallbackError);
        setInsights("*AI Insights could not be generated at this time. Please try again later.*");
      }
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/20 dark:border-primary/20">
      <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4" />
        AI Coach Insights
      </h3>

      {!insights ? (
        <button 
          onClick={generateInsights}
          disabled={loadingInsights}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black transition hover:bg-primary/90 disabled:opacity-50 shadow-sm"
        >
          {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {loadingInsights ? "Analyzing match..." : "Generate Insights"}
        </button>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 text-xs">
          <ReactMarkdown>{insights}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export function MatchAnalyticsSection({ matchId }: MatchAnalyticsSectionProps) {
  return (
    <div className="space-y-4">
      <StrokeAnalyticsSection matchId={matchId} />
      <AICoachInsightsSection matchId={matchId} />
    </div>
  );
}
