import { useEffect, useState, useRef } from "react";
import { useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import type { BwfMatchState } from "@/types/umpire";

export default function ObsOverlayScoreboard() {
  const { matchId } = useParams<{ matchId?: string }>();
  const [matchState, setMatchState] = useState<BwfMatchState | null>(null);

  useEffect(() => {
    async function fetchLiveMatch() {
      const { data } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .maybeSingle();

      if (data?.value) {
        const matches = data.value as Record<string, BwfMatchState>;
        if (matchId && matches[matchId]) {
          setMatchState(matches[matchId]);
        } else {
          // If no matchId provided or matchId not found, pick the first active playing match
          const active = Object.values(matches).find(m => m.status === "playing" || m.status === "setup");
          if (active) setMatchState(active);
        }
      }
    }

    fetchLiveMatch();

    // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
    const instantChannel = supabase.channel("obs_instant_scores");
    instantChannel
      .on("broadcast", { event: "score_update" }, (e) => {
        if (e.payload) {
          const bwf = e.payload as BwfMatchState;
          if (matchId && (bwf.id === matchId || (bwf as any).dbId === matchId)) {
            setMatchState(bwf);
          } else if (!matchId && (bwf.status === "playing" || bwf.status === "setup")) {
            setMatchState(bwf);
          }
        }
      })
      .subscribe();

    // Channel 2: Postgres Changes fallback (site_data updates)
    const sub = supabase
      .channel("obs_overlay_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => {
          if ((payload.new as any)?.value) {
            const matches = (payload.new as any).value as Record<string, BwfMatchState>;
            if (matchId && matches[matchId]) {
              setMatchState(matches[matchId]);
            } else {
              const active = Object.values(matches).find(m => m.status === "playing" || m.status === "setup");
              if (active) setMatchState(active);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(instantChannel);
      supabase.removeChannel(sub);
    };
  }, [matchId]);

  if (!matchState) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-end p-6 select-none pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 rounded-2xl px-6 py-3 font-bold text-sm shadow-2xl flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span>OBS Scoreboard Overlay · Standby (No active broadcast)</span>
        </div>
      </div>
    );
  }

  const { t1, t2, pointsToWin, status, serverTeam } = matchState;
  const isT1Server = serverTeam === 1 && status === "playing";
  const isT2Server = serverTeam === 2 && status === "playing";

  // Deuce & Match Point calculation
  const isDeuce = t1.score >= pointsToWin - 1 && t2.score >= pointsToWin - 1 && t1.score === t2.score;
  const t1IsMatchPoint = t1.score >= pointsToWin - 1 && t1.score > t2.score;
  const t2IsMatchPoint = t2.score >= pointsToWin - 1 && t2.score > t1.score;

  return (
    <div className="w-screen h-screen bg-transparent flex flex-col justify-end p-8 select-none pointer-events-none font-sans">
      <div className="max-w-4xl w-full mx-auto bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white relative overflow-hidden">
        {/* Accent top gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />

        {/* Header Bar */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              IISc Badminton • Live Broadcast
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isDeuce && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/20 border border-amber-500/50 text-amber-400 px-2.5 py-0.5 rounded-full animate-bounce">
                ⚡ DEUCE
              </span>
            )}
            {(t1IsMatchPoint || t2IsMatchPoint) && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-rose-500/20 border border-rose-500/50 text-rose-400 px-2.5 py-0.5 rounded-full animate-pulse">
                🔥 MATCH POINT
              </span>
            )}
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {matchState.inferredCategory || matchState.category} • Best of {matchState.bestOfSets}
            </span>
          </div>
        </div>

        {/* Main Lower-Third Teams Score Row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          {/* Team 1 */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
            isT1Server ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]" : "bg-slate-900/60 border-slate-800"
          }`}>
            <div className="min-w-0 pr-2">
              <p className="text-lg font-black truncate text-slate-100 leading-tight">
                {t1.p1Name}
              </p>
              {t1.p2Name && (
                <p className="text-sm font-bold truncate text-slate-400">
                  {t1.p2Name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isT1Server && (
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse shrink-0" />
              )}
              <span className="text-4xl font-black tabular-nums text-emerald-400">
                {t1.score}
              </span>
            </div>
          </div>

          {/* VS Divider & Sets */}
          <div className="text-center px-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">VS</span>
            {matchState.setsHistory?.length > 0 && (
              <p className="text-[10px] font-mono text-slate-400 mt-1 whitespace-nowrap">
                {matchState.setsHistory.join(" | ")}
              </p>
            )}
          </div>

          {/* Team 2 */}
          <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
            isT2Server ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.15)]" : "bg-slate-900/60 border-slate-800"
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black tabular-nums text-indigo-400">
                {t2.score}
              </span>
              {isT2Server && (
                <span className="w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)] animate-pulse shrink-0" />
              )}
            </div>
            <div className="min-w-0 pl-2 text-right">
              <p className="text-lg font-black truncate text-slate-100 leading-tight">
                {t2.p1Name}
              </p>
              {t2.p2Name && (
                <p className="text-sm font-bold truncate text-slate-400">
                  {t2.p2Name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
