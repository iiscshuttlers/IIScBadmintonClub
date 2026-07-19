import { useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { InfoModal } from "@/components/InfoModal";
import { supabase } from "@/lib/supabase";
import { intensityColor } from "@/lib/intensityColor";

interface RallyRow {
  rally_number: number;
  duration_ms: number;
  shot_count: number;
  smash_count: number;
  avg_intensity: number | null;
  peak_intensity: number | null;
  scoring_team?: 1 | 2 | null;
  t1_score?: number | null;
  t2_score?: number | null;
}

export function RallyBreakdown({ matchId, matchSource }: { matchId: string; matchSource: "friendly" | "tournament" | "practice" }) {
  const [rallies, setRallies] = useState<RallyRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRallies(null);
    supabase
      .from("match_rally_stats")
      .select("rally_number, duration_ms, shot_count, smash_count, avg_intensity, peak_intensity, scoring_team, t1_score, t2_score")
      .eq("match_id", matchId)
      .eq("match_source", matchSource)
      .order("rally_number", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("Failed to load rally breakdown", error); setRallies([]); return; }
        setRallies(data ?? []);
      });
    return () => { cancelled = true; };
  }, [matchId, matchSource]);

  if (rallies === null) {
    return (
      <div className="mt-4 flex items-center justify-center py-6 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading rallies...
      </div>
    );
  }

  if (rallies.length === 0) return null;

  const maxDuration = Math.max(...rallies.map(r => r.duration_ms), 1);
  const maxIntensity = Math.max(...rallies.map(r => r.peak_intensity ?? r.avg_intensity ?? 0), 1);

  return (
    <div className="mt-4 bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
      <h4 className="text-xs font-black text-slate-100 flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        Rally Breakdown ({rallies.length} rallies)
        <InfoModal
          title="RALLY BREAKDOWN"
          items={[
            { badge: "USAGE", title: "How to use", desc: "Scan the timeline of your match. Longer bars mean longer rallies. The color shows intensity: blue is calm, amber is moderate, and rose is explosive (lots of smashes or fast footwork). Hover over a bar to see exact shot counts." },
            { badge: "LOGIC", title: "How it works", desc: "It fetches telemetry data for the match from the database and maps rally duration to CSS width percentages. The intensity color scale is calculated by normalizing the peak/avg intensity values." }
          ]}
        />
      </h4>
      <div className="space-y-1.5">
        {rallies.map(r => {
          const widthPct = Math.max(6, (r.duration_ms / maxDuration) * 100);
          const intensityPct = (r.avg_intensity ?? 0) / maxIntensity;
          return (
            <div key={r.rally_number} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 w-6 shrink-0 text-right">{r.rally_number}</span>
              <div className="flex-1 h-4 bg-slate-800 rounded-md overflow-hidden">
                <div
                  className={`h-full ${intensityColor(intensityPct)} rounded-md transition-all`}
                  style={{ width: `${widthPct}%` }}
                  title={`${(r.duration_ms / 1000).toFixed(1)}s · ${r.shot_count} shots · ${r.smash_count} smashes`}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 w-10 shrink-0 text-right">{(r.duration_ms / 1000).toFixed(1)}s</span>
              {r.scoring_team && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm shrink-0 ${r.scoring_team === 1 ? "bg-primary/20 text-primary" : "bg-sky-500/20 text-sky-400"}`}>
                  T{r.scoring_team}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-slate-500 mt-3">Bar length = rally duration · color = intensity (blue calm → amber moderate → rose explosive)</p>
    </div>
  );
}
