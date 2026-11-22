import { Link } from "wouter";
import { BackButton } from "@/components/ui/BackButton";
import { useLiveSiteData } from "@/hooks/useMatches";
import { Tv2, Activity, ShieldCheck, MonitorPlay, ArrowLeft, Camera, Shuffle } from "lucide-react";
import type { BwfMatchState } from "@/types/umpire";

export default function TvScoreboardIndex() {
  const { data: rawLiveMatches, isLoading } = useLiveSiteData("live_matches", 5000);
  
  const liveMatches = rawLiveMatches as Record<string, BwfMatchState> | null;
  const activeMatches = Object.entries(liveMatches || {}).filter(([_, m]) => m.status === "playing");

  return (
    <div className="min-h-screen bg-background p-6 text-soft relative">
      <BackButton parent="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2 bg-card hover:bg-muted text-muted-foreground hover:text-soft rounded-full transition border border-border shadow-md flex items-center gap-2 pr-4">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-bold">Back</span>
        </BackButton>
      <div className="max-w-4xl mx-auto space-y-8 mt-12 sm:mt-16">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-info/10 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-info/20 shadow-[0_0_40px_-10px_color-mix(in_srgb,var(--info)_30%,transparent)]">
            <MonitorPlay className="w-10 h-10 text-info" />
          </div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-info to-info">
            TV Scoreboard
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-lg mx-auto">
            Select an active match to project a digital scoreboard or stream live with phone camera overlay.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link href="/tv/camera">
              <button className="px-5 py-3 bg-gradient-to-r from-danger to-danger hover:from-danger/90 hover:to-danger/90 text-on-accent font-black rounded-2xl shadow-lg flex items-center gap-2 text-sm transition active:scale-95 cursor-pointer">
                <Camera className="w-5 h-5" /> Phone Camera Broadcast
              </button>
            </Link>
            <Link href="/tv/draw">
              <button className="px-5 py-3 bg-gradient-to-r from-warning to-warning hover:from-warning/90 hover:to-warning/90 text-warning-foreground font-black rounded-2xl shadow-lg flex items-center gap-2 text-sm transition active:scale-95 cursor-pointer">
                <Shuffle className="w-5 h-5" /> Draw &amp; Court Display
              </button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-4">
            <div className="w-10 h-10 border-4 border-info/30 border-t-info rounded-full animate-spin"></div>
            <p className="text-muted-foreground font-medium">Scanning for active broadcasts...</p>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="bg-card/50 rounded-[2rem] p-12 text-center border border-border/50 backdrop-blur-xl">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-soft mb-2">No Active Matches</h3>
            <p className="text-muted-foreground text-lg">There are currently no matches being umpired. Once an umpire starts a match, it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeMatches.map(([umpireId, match]) => (
              <Link key={umpireId} href={`/tv/${umpireId}`}>
                <div className="group cursor-pointer bg-card rounded-[2rem] p-6 border border-border hover:border-info/50 transition-all duration-300 hover:shadow-[0_0_30px_-5px_color-mix(in_srgb,var(--info)_20%,transparent)] hover:-translate-y-1 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-danger"></span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-5 h-5 text-info" />
                    <span className="font-bold text-info tracking-wide uppercase text-sm">
                      Umpire: {match.umpireName || "Unknown"}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-lg font-black text-soft">
                      <div className="truncate max-w-[140px]">
                        {match.t1.p1Name}
                        {match.t1.p2Name && <span className="text-muted-foreground text-sm block">{match.t1.p2Name}</span>}
                      </div>
                      <div className="text-3xl text-foreground drop-shadow-[0_0_10px_color-mix(in_srgb,var(--foreground)_30%,transparent)]">{match.t1.score}</div>
                    </div>
                    
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-muted-strong to-transparent"></div>
                    
                    <div className="flex justify-between items-center text-lg font-black text-soft">
                      <div className="truncate max-w-[140px]">
                        {match.t2.p1Name}
                        {match.t2.p2Name && <span className="text-muted-foreground text-sm block">{match.t2.p2Name}</span>}
                      </div>
                      <div className="text-3xl text-foreground drop-shadow-[0_0_10px_color-mix(in_srgb,var(--foreground)_30%,transparent)]">{match.t2.score}</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-info/20 text-info rounded-xl font-bold group-hover:bg-info group-hover:text-info-foreground transition-colors">
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
