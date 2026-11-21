import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { BwfMatchState } from "@/types/umpire";
import { Loader2, ArrowLeft, X } from "lucide-react";
import { fetchLiveMatchesRow, subscribeToTvScoreboard } from "@/services/matchService";

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
      const data = await fetchLiveMatchesRow();

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
    
    // Channel 1: instant broadcast; channel 2: site_data postgres_changes fallback.
    return subscribeToTvScoreboard(matchId, {
      onScoreUpdate: (e) => {
        if (e.payload && (e.payload.id === matchId || e.payload.dbId === matchId)) {
          setMatchState(e.payload as BwfMatchState);
        }
      },
      onLiveMatchesChange: (payload) => {
        const newValue = (payload.new as Record<string, unknown>)?.value as Record<string, BwfMatchState> | undefined;
        if (newValue && newValue[matchId]) {
          setMatchState(newValue[matchId]);
        } else {
          setMatchState(null);
        }
      },
    });
  }, [matchId, queryData]);

  useEffect(() => {
    if (!isLoading) setLoading(false);
  }, [isLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-16 h-16 text-accent animate-spin" />
      </div>
    );
  }

  if (!matchState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground space-y-8">
        <h1 className="text-6xl font-black text-muted-foreground">Match Ended</h1>
        <button 
          onClick={() => setLocation("/tv")}
          className="px-8 py-4 bg-muted rounded-2xl text-2xl font-bold flex items-center gap-4 hover:bg-muted-strong transition"
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
      ? "text-team-1 drop-shadow-[0_0_80px_color-mix(in_srgb,var(--team-1)_50%,transparent)]"
      : "text-team-2 drop-shadow-[0_0_80px_color-mix(in_srgb,var(--team-2)_50%,transparent)]";
    const bgClass = team === 1
      ? "from-team-1/10 via-transparent to-transparent"
      : "from-team-2/10 via-transparent to-transparent";
    const dotColor = team === 1 ? "bg-team-1" : "bg-team-2";
    const dotGlow = team === 1
      ? "shadow-[0_0_25px_6px_color-mix(in_srgb,var(--team-1)_60%,transparent)]"
      : "shadow-[0_0_25px_6px_color-mix(in_srgb,var(--team-2)_60%,transparent)]";
    const setDot = team === 1 ? "bg-team-1" : "bg-team-2";
    const setGlow = team === 1
      ? "shadow-[0_0_12px_color-mix(in_srgb,var(--team-1)_70%,transparent)]"
      : "shadow-[0_0_12px_color-mix(in_srgb,var(--team-2)_70%,transparent)]";

    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative transition-all duration-500 ${serving ? `bg-gradient-to-br ${bgClass}` : ""}`}>
        {/* Player names & Server indicator */}
        <div className="mb-auto mt-4 md:mt-8 flex flex-col items-center text-center">
          {t.teamName && (
            <div className="text-lg md:text-2xl font-bold tracking-[0.2em] text-muted-foreground mb-2 uppercase">{t.teamName}</div>
          )}
          <div className="relative">
            <div className="text-4xl md:text-6xl xl:text-7xl font-black tracking-tight text-foreground/95 truncate max-w-[35vw] px-2">
              {t.p1Name}
            </div>
            {serving && (matchState.serverPlayerIndex === 0 || matchState.serverPlayerIndex === undefined) && (
              <div className={`absolute top-1/2 -translate-y-1/2 ${team === 1 ? "-right-6 md:-right-10" : "-left-6 md:-left-10"} w-4 h-4 md:w-6 md:h-6 rounded-full ${dotColor} ${dotGlow} animate-pulse`} />
            )}
          </div>
          {t.p2Name && (
            <div className="relative mt-1">
              <div className="text-2xl md:text-4xl xl:text-5xl font-bold tracking-tight text-muted-foreground/80 truncate max-w-[35vw] px-2">
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
          <div className={`text-[28vw] md:text-[22vw] xl:text-[18rem] font-black leading-none tracking-tighter tabular-nums transition-all duration-300 ${serving ? glowClass : "text-foreground/90"}`}>
            {t.score}
          </div>
        </div>

        {/* Sets won pills */}
        <div className="mt-auto mb-4 flex items-center gap-3">
          {Array.from({ length: matchState.bestOfSets }).map((_, i) => (
            <div
              key={i}
              className={`w-5 h-5 md:w-7 md:h-7 rounded-full transition-all duration-300 ${i < t.games ? `${setDot} ${setGlow}` : "bg-muted border border-border-strong"}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] bg-background text-foreground flex flex-col overflow-hidden font-sans selection:bg-transparent relative group">
      {/* Subtle animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_srgb,var(--team-1)_6%,transparent)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,color-mix(in_srgb,var(--team-2)_6%,transparent)_0%,transparent_50%)] pointer-events-none" />

      {/* Exit Button (Always partially visible, fully visible on hover) */}
      <button 
        onClick={() => setLocation("/tv")}
        className="absolute top-6 right-6 z-50 p-3 bg-muted/60 hover:bg-muted-strong text-foreground rounded-2xl opacity-40 hover:opacity-100 transition-opacity backdrop-blur-md shadow-2xl border border-border-strong/50"
        title="Exit Scoreboard"
      >
        <X className="w-7 h-7" />
      </button>
      
      {/* Top Header */}
      <div className="h-20 md:h-28 w-full flex items-center justify-between px-8 md:px-12 bg-gradient-to-b from-background/80 to-transparent relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse shadow-[0_0_8px_color-mix(in_srgb,var(--live)_80%,transparent)]" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-live">LIVE</span>
          </div>
          <div className="w-px h-8 bg-muted-strong/50" />
          <div className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-team-1 to-team-2 tracking-wide">
            IISc Badminton
          </div>
          {matchState.tournament && (
            <>
              <div className="w-px h-8 bg-muted-strong/50" />
              <div className="text-lg font-bold text-muted-foreground tracking-wider uppercase">{matchState.tournament}</div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          {isDeuce && (
            <div className="px-4 py-1.5 bg-warning/15 border border-warning/40 text-warning text-xl font-black rounded-xl tracking-widest animate-bounce">
              ⚡ DEUCE
            </div>
          )}
          {isMatchPoint && (
            <div className="px-4 py-1.5 bg-danger/15 border border-danger/40 text-danger text-xl font-black rounded-xl tracking-widest animate-pulse">
              🔥 MATCH POINT
            </div>
          )}
          {isGamePoint && (
            <div className="px-4 py-1.5 bg-info/15 border border-info/40 text-info text-xl font-black rounded-xl tracking-widest">
              GAME POINT
            </div>
          )}
          <div className="text-xl font-bold text-muted-foreground tracking-widest uppercase">
            {matchState.inferredCategory || matchState.category}
          </div>
          <div className="w-px h-8 bg-muted-strong/50" />
          <div className="text-xl font-bold text-muted-foreground">BO{matchState.bestOfSets}</div>
          <div className="w-px h-8 bg-muted-strong/50" />
          <div className="text-xl font-mono font-bold text-muted-foreground tabular-nums">{clock}</div>
        </div>
      </div>

      {/* Main Score Area */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* Center divider */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-muted-strong/30 to-transparent hidden md:block z-0" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-muted-strong/30 to-transparent md:hidden z-0" />
        
        {/* Center VS badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-card border border-border-strong/50 flex items-center justify-center shadow-2xl">
            <span className="text-lg md:text-xl font-black text-muted-foreground tracking-widest">VS</span>
          </div>
        </div>

        {renderTeamBlock(1)}
        {renderTeamBlock(2)}
      </div>

      {/* Bottom Footer */}
      <div className="h-16 md:h-24 w-full flex items-center justify-center px-12 bg-gradient-to-t from-background/80 to-transparent relative z-10">
        <div className="flex items-center gap-6 text-xl md:text-2xl font-bold text-muted-foreground tracking-wider">
          {matchState.setsHistory?.length > 0 ? (
            <>
              <span className="text-muted-foreground uppercase text-sm tracking-[0.2em]">Previous Sets</span>
              {matchState.setsHistory.map((s: string, i: number) => (
                <span key={i} className="px-4 py-1.5 bg-card/80 border border-border rounded-xl text-foreground font-mono font-black text-lg">
                  {s}
                </span>
              ))}
            </>
          ) : (
            <span className="text-muted-foreground text-sm uppercase tracking-[0.2em]">Game {matchState.t1.games + matchState.t2.games + 1}</span>
          )}
        </div>
      </div>
    </div>
  );
}
