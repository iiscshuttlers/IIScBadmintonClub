import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import type { BwfMatchState } from "@/types/umpire";

export default function ObsOverlayScoreboard() {
  const { matchId } = useParams<{ matchId?: string }>();
  const [matchState, setMatchState] = useState<BwfMatchState | null>(null);
  const [scoreFlash, setScoreFlash] = useState<1 | 2 | null>(null);
  const prevScoreRef = { t1: 0, t2: 0 };

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

  // Score flash animation
  useEffect(() => {
    if (!matchState) return;
    if (matchState.t1.score !== prevScoreRef.t1) {
      setScoreFlash(1);
      setTimeout(() => setScoreFlash(null), 600);
    }
    if (matchState.t2.score !== prevScoreRef.t2) {
      setScoreFlash(2);
      setTimeout(() => setScoreFlash(null), 600);
    }
    prevScoreRef.t1 = matchState.t1.score;
    prevScoreRef.t2 = matchState.t2.score;
  }, [matchState?.t1.score, matchState?.t2.score]);

  if (!matchState) {
    return (
      <div className="w-screen h-screen bg-transparent flex items-end p-6 select-none pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 text-slate-300 rounded-2xl px-6 py-3 font-bold text-sm shadow-2xl flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span>OBS Scoreboard Overlay · Standby (No active broadcast)</span>
        </div>
      </div>
    );
  }

  const { t1, t2, pointsToWin, status, serverTeam } = matchState;
  const isT1Server = serverTeam === 1 && status === "playing";
  const isT2Server = serverTeam === 2 && status === "playing";
  const ptw = pointsToWin || 21;
  const isDeuce = t1.score >= ptw - 1 && t2.score >= ptw - 1 && t1.score === t2.score;
  const t1Lead = t1.score >= ptw - 1 && t1.score > t2.score;
  const t2Lead = t2.score >= ptw - 1 && t2.score > t1.score;
  const gamesNeeded = Math.floor(matchState.bestOfSets / 2);
  const isMatchPoint = (t1Lead && t1.games === gamesNeeded) || (t2Lead && t2.games === gamesNeeded);

  const renderTeamRow = (team: 1 | 2) => {
    const t = team === 1 ? t1 : t2;
    const serving = team === 1 ? isT1Server : isT2Server;
    const flashing = scoreFlash === team;
    const accentColor = team === 1 ? "emerald" : "indigo";

    return (
      <div
        className={`flex items-center gap-0 transition-all duration-200 ${flashing ? "scale-[1.02]" : ""}`}
      >
        {/* Server dot + Names */}
        <div className={`flex items-center gap-3 px-5 py-3 min-w-[280px] border-r transition-colors duration-300 ${
          serving
            ? `bg-${accentColor}-500/12 border-${accentColor}-500/30`
            : "bg-slate-900/80 border-slate-800/60"
        }`}
          style={serving ? {
            backgroundColor: team === 1 ? "rgba(16,185,129,0.08)" : "rgba(99,102,241,0.08)",
            borderColor: team === 1 ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.25)",
          } : undefined}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${
              serving ? "animate-pulse" : "bg-slate-700"
            }`}
            style={serving ? {
              backgroundColor: team === 1 ? "#34d399" : "#818cf8",
              boxShadow: team === 1 ? "0 0 12px rgba(52,211,153,0.8)" : "0 0 12px rgba(129,140,248,0.8)",
            } : undefined}
          />
          <div className="min-w-0">
            <p className="text-[15px] font-black text-white/95 truncate leading-tight">{t.p1Name}</p>
            {t.p2Name && <p className="text-xs font-bold text-slate-400 truncate leading-tight">{t.p2Name}</p>}
          </div>
        </div>

        {/* Sets won */}
        <div className="flex items-center gap-1.5 px-3 bg-slate-900/90 border-r border-slate-800/60 self-stretch">
          {Array.from({ length: matchState.bestOfSets }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < t.games
                  ? team === 1 ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.6)]"
                  : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Score */}
        <div
          className={`min-w-[72px] text-center px-4 py-2.5 font-black text-3xl tabular-nums transition-all duration-300 ${
            flashing ? "bg-white/10" : "bg-slate-950/90"
          }`}
          style={{
            color: serving ? (team === 1 ? "#34d399" : "#818cf8") : "#e2e8f0",
            textShadow: serving ? `0 0 20px ${team === 1 ? "rgba(52,211,153,0.5)" : "rgba(129,140,248,0.5)"}` : "none",
          }}
        >
          {t.score}
        </div>
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-transparent flex flex-col justify-end p-8 select-none pointer-events-none font-sans">
      <div className="max-w-2xl w-full mx-auto relative">
        {/* Main scoreboard card */}
        <div className="bg-slate-950/92 backdrop-blur-2xl border border-slate-800/70 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
          
          {/* Accent top bar */}
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2 border-b border-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/90">
                IISc Badminton • Live
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDeuce && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-400 px-2 py-0.5 rounded-md animate-bounce">
                  ⚡ DEUCE
                </span>
              )}
              {isMatchPoint && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-rose-500/15 border border-rose-500/40 text-rose-400 px-2 py-0.5 rounded-md animate-pulse">
                  🔥 MATCH POINT
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {matchState.inferredCategory || matchState.category} • BO{matchState.bestOfSets}
              </span>
            </div>
          </div>

          {/* Team rows */}
          <div className="flex flex-col divide-y divide-slate-800/40">
            {renderTeamRow(1)}
            {renderTeamRow(2)}
          </div>

          {/* Sets history footer */}
          {matchState.setsHistory?.length > 0 && (
            <div className="px-5 py-1.5 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-500 font-bold">
              <span className="uppercase tracking-wider">Sets</span>
              <span className="text-slate-300 font-mono tracking-wider">
                {matchState.setsHistory.join("  ·  ")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
