import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Activity, Tv2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { BwfMatchState } from "../umpire/UmpireEngine";

function MatchBroadcastCard({ match }: { match: BwfMatchState }) {
  if (match.status === "setup") return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 sm:p-10 text-white max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm mb-1">
            <Activity className="w-5 h-5 animate-pulse" /> Live Broadcast
          </div>
          <div className="text-slate-400 text-xs font-bold">
            {match.isFriendly ? "Friendly" : `Tournament • ${match.matchNumber}`} • {match.inferredCategory || match.category} • Best of {match.bestOfSets} ({match.pointsToWin} pts) • Umpire: {match.umpireName}
          </div>
        </div>
      </div>

      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match Finished!</h2>
          <p className="text-xl text-slate-300">
            {match.winner === 1 ? match.t1.p1Name : match.t2.p1Name} Won {match.setsHistory.join(", ")}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 1 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 1 && match.serverPlayerIndex === 0 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {match.t1.p1Name}
              </h3>
              {match.t1.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 1 && match.serverPlayerIndex === 1 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  {match.t1.p2Name}
                </h3>
              )}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t1.score}
              </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t1.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>

          <div className="text-4xl font-black italic text-slate-700 text-center py-4">VS</div>

          <div className={`p-6 rounded-3xl border-2 transition-all ${match.serverTeam === 2 ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "bg-slate-800/50 border-slate-700/50"}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                {match.serverTeam === 2 && match.serverPlayerIndex === 0 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                {match.t2.p1Name}
              </h3>
              {match.t2.p2Name && (
                <h3 className="text-xl font-bold truncate flex items-center justify-center gap-2">
                  {match.serverTeam === 2 && match.serverPlayerIndex === 1 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  {match.t2.p2Name}
                </h3>
              )}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="text-[8rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md">
                {match.t2.score}
              </div>
            </div>
            
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full ${i < match.t2.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveScoreSection() {
  const { session, profile, isAdmin, isUmpire } = useAuth();
  const [liveMatches, setLiveMatches] = useState<Record<string, BwfMatchState>>({});

  useEffect(() => {
    supabase
      .from("site_data")
      .select("value")
      .eq("key", "live_matches")
      .single()
      .then(({ data }) => {
        if (data?.value) setLiveMatches(data.value);
      });

    const sub = supabase
      .channel("live_matches_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_data",
          filter: "key=eq.live_matches",
        },
        (payload) => {
          if (payload.new && (payload.new as any).value) {
            setLiveMatches((payload.new as any).value);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const activeMatchList = Object.values(liveMatches).filter(match => {
    if (!match.isFriendly) return true; // Tournaments are public
    if (isAdmin) return true;
    if (session?.user?.id === match.id) return true; // Umpire
    if (!profile) return false;

    const participants = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean);
    if (participants.includes(profile.id)) return true; // Player
    
    const buddies = profile.buddies || [];
    const following = profile.following || [];
    return participants.some(pid => buddies.includes(pid) || following.includes(pid));
  });

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 rounded-[2rem] p-6 shadow-xl border border-slate-800 gap-4 text-center sm:text-left">
        <div>
          <h2 className="text-xl font-black text-white flex items-center justify-center sm:justify-start gap-2">
            <Tv2 className="w-6 h-6 text-emerald-400" /> Live Broadcasts
          </h2>
          <p className="text-slate-400 text-sm mt-1">Watch live matches happening right now.</p>
        </div>
      </div>

      {activeMatchList.filter(m => m.status !== "setup").length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800 border-dashed">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-20 text-slate-400" />
          <h2 className="text-2xl font-bold text-slate-300">No Live Matches</h2>
          <p className="mt-2 text-slate-500">Wait for someone to start broadcasting...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeMatchList.map((m) => (
            <MatchBroadcastCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
