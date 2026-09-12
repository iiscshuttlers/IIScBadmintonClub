import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { BwfMatchState } from "@/types/umpire";
import { Loader2, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function TvScoreboard() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const [matchState, setMatchState] = useState<BwfMatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState("");

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const { data: queryData, isLoading } = useQuery({
    queryKey: ['tv_scoreboard', matchId],
    queryFn: async () => {
      if (!matchId) return null;
      const { data } = await supabase
        .from("site_data")
        .select("value")
        .eq("key", "live_matches")
        .maybeSingle();
      
      if (data?.value && data.value[matchId]) {
        return data.value[matchId] as BwfMatchState;
      }
      return null;
    },
    refetchInterval: (query) => (query.state.error ? false : 5000),
    staleTime: 2000,
    gcTime: 1000 * 60 * 10,
    enabled: !!matchId,
  });

  useEffect(() => {
    if (!matchId) return;

    if (queryData && !matchState) {
      setMatchState(queryData);
    }
    
    // Channel 1: Sub-50ms Direct WebSocket Broadcast (Instant score sync)
    const instantChannel = supabase.channel(`tv_instant_${matchId}`);
    instantChannel
      .on("broadcast", { event: "score_update" }, (e) => {
        if (e.payload && (e.payload.id === matchId || e.payload.dbId === matchId)) {
          setMatchState(e.payload as BwfMatchState);
        }
      })
      .subscribe();

    // Channel 2: Postgres Changes fallback (site_data updates)
    const sub = supabase
      .channel(`tv_scoreboard_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.live_matches",
        },
        (payload) => {
          const newValue = (payload.new as Record<string, unknown>)?.value as Record<string, BwfMatchState> | undefined;
          if (newValue && newValue[matchId]) {
            setMatchState(newValue[matchId]);
          } else {
            setMatchState(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(instantChannel);
      supabase.removeChannel(sub);
    };
  }, [matchId, queryData]);

  useEffect(() => {
    if (!isLoading) setLoading(false);
  }, [isLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!matchState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-8">
        <h1 className="text-6xl font-black text-slate-500">Match Ended</h1>
        <button 
          onClick={() => setLocation("/tv")}
          className="px-8 py-4 bg-slate-800 rounded-2xl text-2xl font-bold flex items-center gap-4 hover:bg-slate-700 transition"
        >
          <ArrowLeft className="w-8 h-8" /> Return to Menu
        </button>
      </div>
    );
  }

  const isServer = (team: 1 | 2) => matchState.serverTeam === team && matchState.status === "playing";
  const ptw = matchState.pointsToWin || 21;
  const isDeuce = matchState.t1.score >= ptw - 1 && matchState.t2.score >= ptw - 1 && matchState.t1.score === matchState.t2.score;
  const t1Lead = matchState.t1.score >= ptw - 1 && matchState.t1.score > matchState.t2.score;
  const t2Lead = matchState.t2.score >= ptw - 1 && matchState.t2.score > matchState.t1.score;
  const gamesNeeded = Math.floor(matchState.bestOfSets / 2);
  const isMatchPoint = (t1Lead && matchState.t1.games === gamesNeeded) || (t2Lead && matchState.t2.games === gamesNeeded);
  const isGamePoint = (t1Lead || t2Lead) && !isMatchPoint;

  const renderTeamBlock = (team: 1 | 2) => {
    const t = team === 1 ? matchState.t1 : matchState.t2;
    const serving = isServer(team);
    const color = team === 1 ? "cyan" : "violet";
    const glowClass = team === 1
      ? "text-cyan-400 drop-shadow-[0_0_80px_rgba(34,211,238,0.5)]"
      : "text-violet-400 drop-shadow-[0_0_80px_rgba(167,139,250,0.5)]";
    const bgClass = team === 1
      ? "from-cyan-950/30 via-transparent to-transparent"
      : "from-violet-950/30 via-transparent to-transparent";
    const dotColor = team === 1 ? "bg-cyan-400" : "bg-violet-400";
    const dotGlow = team === 1
      ? "shadow-[0_0_25px_6px_rgba(34,211,238,0.6)]"
      : "shadow-[0_0_25px_6px_rgba(167,139,250,0.6)]";
    const setDot = team === 1 ? "bg-cyan-500" : "bg-violet-500";
    const setGlow = team === 1
      ? "shadow-[0_0_12px_rgba(6,182,212,0.7)]"
      : "shadow-[0_0_12px_rgba(139,92,246,0.7)]";

    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative transition-all duration-500 ${serving ? `bg-gradient-to-br ${bgClass}` : ""}`}>
        {/* Player names & Server indicator */}
        <div className="mb-auto mt-4 md:mt-8 flex flex-col items-center text-center">
          {t.teamName && (
            <div className="text-lg md:text-2xl font-bold tracking-[0.2em] text-slate-500/80 mb-2 uppercase">{t.teamName}</div>
          )}
          <div className="relative">
            <div className="text-4xl md:text-6xl xl:text-7xl font-black tracking-tight text-white/95 truncate max-w-[35vw] px-2">
              {t.p1Name}
            </div>
            {serving && (matchState.serverPlayerIndex === 0 || matchState.serverPlayerIndex === undefined) && (
              <div className={`absolute top-1/2 -translate-y-1/2 ${team === 1 ? "-right-6 md:-right-10" : "-left-6 md:-left-10"} w-4 h-4 md:w-6 md:h-6 rounded-full ${dotColor} ${dotGlow} animate-pulse`} />
            )}
          </div>
          {t.p2Name && (
            <div className="relative mt-1">
              <div className="text-2xl md:text-4xl xl:text-5xl font-bold tracking-tight text-slate-400/80 truncate max-w-[35vw] px-2">
                {t.p2Name}
              </div>
              {serving && matchState.serverPlayerIndex === 1 && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${team === 1 ? "-right-5 md:-right-8" : "-left-5 md:-left-8"} w-3 h-3 md:w-5 md:h-5 rounded-full ${dotColor} ${dotGlow} animate-pulse`} />
              )}
            </div>
          )}
        </div>

        {/* Giant score */}
        <div className="relative my-auto">
          <div className={`text-[28vw] md:text-[22vw] xl:text-[18rem] font-black leading-none tracking-tighter tabular-nums transition-all duration-300 ${serving ? glowClass : "text-white/90"}`}>
            {t.score}
          </div>
        </div>

        {/* Sets won pills */}
        <div className="mt-auto mb-4 flex items-center gap-3">
          {Array.from({ length: matchState.bestOfSets }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 md:w-7 md:h-7 rounded-full transition-all duration-300 ${i < t.games ? `${setDot} ${setGlow}` : "bg-slate-800 border border-slate-700"}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden font-sans selection:bg-transparent relative group">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.06)_0%,transparent_50%)] pointer-events-none" />

      {/* Exit Button (Always partially visible, fully visible on hover) */}
      <button 
        onClick={() => setLocation("/tv")}
        className="absolute top-6 right-6 z-50 p-3 bg-slate-800/60 hover:bg-slate-700 text-white rounded-2xl opacity-40 hover:opacity-100 transition-opacity backdrop-blur-md shadow-2xl border border-slate-700/50"
        title="Exit Scoreboard"
      >
        <X className="w-7 h-7" />
      </button>
      
      {/* Top Header */}
      <div className="h-20 md:h-28 w-full flex items-center justify-between px-8 md:px-12 bg-gradient-to-b from-slate-950/80 to-transparent relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-red-400">LIVE</span>
          </div>
          <div className="w-px h-8 bg-slate-700/50" />
          <div className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400 tracking-wide">
            IISc Badminton
          </div>
          {matchState.tournament && (
            <>
              <div className="w-px h-8 bg-slate-700/50" />
              <div className="text-lg font-bold text-slate-400 tracking-wider uppercase">{matchState.tournament}</div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          {isDeuce && (
            <div className="px-4 py-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xl font-black rounded-xl tracking-widest animate-bounce">
              ⚡ DEUCE
            </div>
          )}
          {isMatchPoint && (
            <div className="px-4 py-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xl font-black rounded-xl tracking-widest animate-pulse">
              🔥 MATCH POINT
            </div>
          )}
          {isGamePoint && (
            <div className="px-4 py-1.5 bg-sky-500/15 border border-sky-500/40 text-sky-400 text-xl font-black rounded-xl tracking-widest">
              GAME POINT
            </div>
          )}
          <div className="text-xl font-bold text-slate-400 tracking-widest uppercase">
            {matchState.inferredCategory || matchState.category}
          </div>
          <div className="w-px h-8 bg-slate-700/50" />
          <div className="text-xl font-bold text-slate-500">BO{matchState.bestOfSets}</div>
          <div className="w-px h-8 bg-slate-700/50" />
          <div className="text-xl font-mono font-bold text-slate-500 tabular-nums">{clock}</div>
        </div>
      </div>

      {/* Main Score Area */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Center divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-slate-700/30 to-transparent hidden md:block z-0" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700/30 to-transparent md:hidden z-0" />
        
        {/* Center VS badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-900 border border-slate-700/50 flex items-center justify-center shadow-2xl">
            <span className="text-lg md:text-xl font-black text-slate-500 tracking-widest">VS</span>
          </div>
        </div>

        {renderTeamBlock(1)}
        {renderTeamBlock(2)}
      </div>

      {/* Bottom Footer */}
      <div className="h-16 md:h-24 w-full flex items-center justify-center px-12 bg-gradient-to-t from-slate-950/80 to-transparent relative z-10">
        <div className="flex items-center gap-6 text-xl md:text-2xl font-bold text-slate-500 tracking-wider">
          {matchState.setsHistory?.length > 0 ? (
            <>
              <span className="text-slate-600 uppercase text-sm tracking-[0.2em]">Previous Sets</span>
              {matchState.setsHistory.map((s: string, i: number) => (
                <span key={i} className="px-4 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white font-mono font-black text-lg">
                  {s}
                </span>
              ))}
            </>
          ) : (
            <span className="text-slate-700 text-sm uppercase tracking-[0.2em]">Game {matchState.t1.games + matchState.t2.games + 1}</span>
          )}
        </div>
      </div>
    </div>
  );
}
