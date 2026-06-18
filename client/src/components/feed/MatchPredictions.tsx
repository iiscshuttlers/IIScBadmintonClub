import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Check } from "lucide-react";
import type { BwfMatchState } from "@/components/umpire/UmpireEngine";

export function MatchPredictions() {
  const { profile } = useAuth();
  const [liveMatches, setLiveMatches] = useState<BwfMatchState[]>([]);
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});

  useEffect(() => {
    const parse = (val: Record<string, BwfMatchState>) => {
      setLiveMatches(Object.values(val).filter((m) => m.status === "playing"));
    };

    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => { if (data?.value) parse(data.value as any); });

    const sub = supabase
      .channel("match_predictions_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => { if ((payload.new as any)?.value) parse((payload.new as any).value); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // Load saved picks from localStorage
  useEffect(() => {
    if (!profile?.id) return;
    const stored = localStorage.getItem(`live_picks_${profile.id}`);
    if (stored) setPicks(JSON.parse(stored));
  }, [profile?.id]);

  const pick = (matchId: string, team: 1 | 2) => {
    if (!profile?.id || picks[matchId]) return;
    const next = { ...picks, [matchId]: team };
    setPicks(next);
    localStorage.setItem(`live_picks_${profile.id}`, JSON.stringify(next));
  };

  if (liveMatches.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-violet-500" />
        <h3 className="font-black text-slate-800 dark:text-white">Who's going to win?</h3>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Live
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {liveMatches.map((m) => {
          const t1Label = m.t1.p2Name
            ? `${m.t1.p1Name.split(" ")[0]} & ${m.t1.p2Name.split(" ")[0]}`
            : m.t1.p1Name;
          const t2Label = m.t2.p2Name
            ? `${m.t2.p1Name.split(" ")[0]} & ${m.t2.p2Name.split(" ")[0]}`
            : m.t2.p1Name;
          const myPick = picks[m.id];

          return (
            <div key={m.id} className="px-5 py-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                {m.isFriendly ? "Friendly" : `Tournament · ${m.matchNumber}`} · {m.inferredCategory || m.category}
              </p>
              {myPick ? (
                <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/20 rounded-xl px-3 py-2.5">
                  <Check className="w-4 h-4 text-violet-500 shrink-0" />
                  <p className="text-sm text-violet-700 dark:text-violet-400 font-bold">
                    You picked <strong>{myPick === 1 ? t1Label : t2Label}</strong>
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => pick(m.id, 1)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-sm font-black text-emerald-700 dark:text-emerald-400 transition truncate"
                  >
                    {t1Label}
                  </button>
                  <button
                    onClick={() => pick(m.id, 2)}
                    className="flex-1 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/20 hover:bg-sky-100 dark:hover:bg-sky-900/30 border border-sky-200 dark:border-sky-800 text-sm font-black text-sky-700 dark:text-sky-400 transition truncate"
                  >
                    {t2Label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
