import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useLiveSiteData } from "@/hooks/useMatches";
import type { BwfMatchState } from "@/types/umpire";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function TvScoreboard() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const [matchState, setMatchState] = useState<BwfMatchState | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial fetch and subscription
  useEffect(() => {
    if (!matchId) return;
    
    // Fetch initial
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => {
        if (data?.value && data.value[matchId]) {
          setMatchState(data.value[matchId] as BwfMatchState);
        }
        setLoading(false);
      });

    // Subscribe
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
            // Match ended or was removed
            setMatchState(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [matchId]);

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

  // Format the team names
  const renderTeamName = (team: 1 | 2) => {
    const p1 = team === 1 ? matchState.t1.p1Name : matchState.t2.p1Name;
    const p2 = team === 1 ? matchState.t1.p2Name : matchState.t2.p2Name;
    
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="text-5xl lg:text-7xl font-black tracking-tight text-white drop-shadow-md truncate max-w-[90vw]">
          {p1}
        </div>
        {p2 && (
          <div className="text-3xl lg:text-5xl font-black tracking-tight text-slate-400 mt-2 truncate max-w-[90vw]">
            {p2}
          </div>
        )}
      </div>
    );
  };

  const isServer = (team: 1 | 2) => matchState.serverTeam === team && matchState.status === "playing";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden font-sans selection:bg-transparent cursor-none">
      
      {/* Top Header info */}
      <div className="h-24 lg:h-32 w-full flex items-center justify-between px-12 bg-gradient-to-b from-slate-900 to-black/0">
        <div className="text-3xl font-black text-cyan-500 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
          IISc Badminton
        </div>
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold text-slate-400 tracking-widest uppercase">
            {matchState.inferredCategory || matchState.category}
          </div>
          <div className="h-8 w-2 bg-slate-700 rounded-full"></div>
          <div className="text-2xl font-bold text-slate-400">
            Best of {matchState.bestOfSets}
          </div>
        </div>
      </div>

      {/* Main Score Area */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        
        {/* Divider Line */}
        <div className="absolute left-0 lg:left-1/2 top-1/2 lg:top-0 w-full lg:w-0 h-0 lg:h-full border-t lg:border-l border-dashed border-slate-700/50 z-0"></div>

        {/* Team 1 Side */}
        <div className={`flex-1 flex flex-col items-center justify-center p-8 relative transition-all duration-500 ${isServer(1) ? 'bg-gradient-to-tr from-cyan-950/40 to-transparent' : ''}`}>
          {isServer(1) && (
            <div className="absolute top-8 right-8 w-8 h-8 rounded-full bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.8)] animate-pulse"></div>
          )}
          
          <div className="mb-auto mt-8">
            {renderTeamName(1)}
          </div>
          
          <div className="relative">
            <div className={`text-[25vw] lg:text-[20rem] font-black leading-none tracking-tighter ${isServer(1) ? 'text-cyan-400 drop-shadow-[0_0_60px_rgba(34,211,238,0.4)]' : 'text-slate-200'} transition-all duration-300`}>
              {matchState.t1.score}
            </div>
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-4">
              {Array.from({ length: matchState.t1.games }).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]"></div>
              ))}
            </div>
          </div>
          <div className="mt-auto"></div>
        </div>

        {/* Team 2 Side */}
        <div className={`flex-1 flex flex-col items-center justify-center p-8 relative transition-all duration-500 ${isServer(2) ? 'bg-gradient-to-tl from-purple-950/40 to-transparent' : ''}`}>
          {isServer(2) && (
            <div className="absolute top-8 left-8 w-8 h-8 rounded-full bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.8)] animate-pulse"></div>
          )}

          <div className="mb-auto mt-8">
            {renderTeamName(2)}
          </div>

          <div className="relative">
            <div className={`text-[25vw] lg:text-[20rem] font-black leading-none tracking-tighter ${isServer(2) ? 'text-purple-400 drop-shadow-[0_0_60px_rgba(168,85,247,0.4)]' : 'text-slate-200'} transition-all duration-300`}>
              {matchState.t2.score}
            </div>
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-4">
              {Array.from({ length: matchState.t2.games }).map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]"></div>
              ))}
            </div>
          </div>
          <div className="mt-auto"></div>
        </div>

      </div>

      {/* Bottom Footer info */}
      <div className="h-24 lg:h-32 w-full flex items-center justify-center px-12 bg-gradient-to-t from-slate-900 to-black/0">
        <div className="flex items-center gap-8 text-3xl font-bold text-slate-500 tracking-wider">
          {matchState.setsHistory.length > 0 ? (
            <>
              <span>PREVIOUS SETS:</span>
              <span className="text-white drop-shadow-md">{matchState.setsHistory.join("  |  ")}</span>
            </>
          ) : (
            <span className="opacity-50">NO PREVIOUS SETS</span>
          )}
        </div>
      </div>
      
    </div>
  );
}
