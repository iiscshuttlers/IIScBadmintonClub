import { Link } from "wouter";
import { useLiveSiteData } from "@/hooks/useMatches";
import { Tv2, Activity, ShieldCheck, MonitorPlay } from "lucide-react";
import type { BwfMatchState } from "@/types/umpire";

export default function TvScoreboardIndex() {
  const { data: rawLiveMatches, isLoading } = useLiveSiteData("live_matches", 5000);
  
  const liveMatches = rawLiveMatches as Record<string, BwfMatchState> | null;
  const activeMatches = Object.entries(liveMatches || {}).filter(([_, m]) => m.status === "playing");

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
      <div className="max-w-4xl mx-auto space-y-8 mt-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-blue-900/30 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-blue-500/20 shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
            <MonitorPlay className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
            TV Scoreboard
          </h1>
          <p className="text-xl text-slate-400 font-medium max-w-lg mx-auto">
            Select an active match to project a massive, full-screen digital scoreboard onto this display.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-4">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium">Scanning for active broadcasts...</p>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="bg-slate-900/50 rounded-[2rem] p-12 text-center border border-slate-800/50 backdrop-blur-xl">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-300 mb-2">No Active Matches</h3>
            <p className="text-slate-500 text-lg">There are currently no matches being umpired. Once an umpire starts a match, it will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeMatches.map(([umpireId, match]) => (
              <Link key={umpireId} href={`/tv/${umpireId}`}>
                <div className="group cursor-pointer bg-slate-900 rounded-[2rem] p-6 border border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.2)] hover:-translate-y-1 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-indigo-300 tracking-wide uppercase text-sm">
                      Umpire: {match.umpireName || "Unknown"}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-lg font-black text-slate-200">
                      <div className="truncate max-w-[140px]">
                        {match.t1.p1Name}
                        {match.t1.p2Name && <span className="text-slate-400 text-sm block">{match.t1.p2Name}</span>}
                      </div>
                      <div className="text-3xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{match.t1.score}</div>
                    </div>
                    
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                    
                    <div className="flex justify-between items-center text-lg font-black text-slate-200">
                      <div className="truncate max-w-[140px]">
                        {match.t2.p1Name}
                        {match.t2.p2Name && <span className="text-slate-400 text-sm block">{match.t2.p2Name}</span>}
                      </div>
                      <div className="text-3xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{match.t2.score}</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-blue-600/20 text-blue-400 rounded-xl font-bold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Tv2 className="w-5 h-5" /> Launch Display
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
