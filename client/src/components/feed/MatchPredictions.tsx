import { useState, useEffect } from "react";
import { feedService } from "@/services/feedService";
import { umpireService } from "@/services/umpireService";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { BwfMatchState } from "@/types/umpire";

type VoteTally = { t1: number; t2: number };

function ProbBar({ t1Pct, t2Pct, t1Label, t2Label, label, tooltip }: {
  t1Pct: number; t2Pct: number; t1Label: string; t2Label: string; label?: string; tooltip?: string;
}) {
  return (
    <div className="mt-1.5">
      {(label || tooltip) && (
        <div className="flex items-center gap-1.5 mb-1">
          {label && <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>}
          {tooltip && (
            <div className="group/tooltip relative flex items-center">
              <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-muted-foreground cursor-help transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-muted text-soft text-xs font-medium p-2.5 rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl border border-border-strong leading-relaxed text-center pointer-events-none">
                {tooltip}
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-border" />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between items-end mb-1 px-0.5">
        <span className="text-[9px] text-primary font-bold break-words flex-1">{t1Label}</span>
        <span className="text-[9px] text-info font-bold break-words flex-1 text-right">{t2Label}</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-2.5">
        {t1Pct > 0 && <div className="bg-primary transition-all duration-700" style={{ width: `${t1Pct}%` }} />}
        {t2Pct > 0 && <div className="bg-info transition-all duration-700" style={{ width: `${t2Pct}%` }} />}
      </div>
    </div>
  );
}

export function MatchPredictionCard({
  matchId,
  t1Label,
  t2Label,
  hasStarted,
  myPick,
  profileId,
  onPick,
  isResultsRevealed = false,
  isAdmin = false,
  onToggleRevealResults,
  compact = false
}: {
  matchId: string;
  t1Label: string;
  t2Label: string;
  hasStarted: boolean;
  myPick: 1 | 2 | undefined;
  profileId: string | undefined;
  onPick: (team: 1 | 2) => void;
  isResultsRevealed?: boolean;
  isAdmin?: boolean;
  onToggleRevealResults?: () => void;
  compact?: boolean;
}) {
  const [tally, setTally] = useState<VoteTally>({ t1: 0, t2: 0 });

  // Load vote tally + realtime (always, so after voting bars update live)
  useEffect(() => {
    const loadTally = async () => {
      const t = await feedService.fetchVoteTally(matchId);
      setTally(t);
    };
    loadTally();

    const unsubscribe = feedService.subscribeToMatchVotes(
      matchId,
      (newVote) => {
        if (profileId && newVote.user_id === profileId) return; // Handled optimistically
        setTally(prev => ({
          t1: prev.t1 + (newVote.pick === 1 ? 1 : 0),
          t2: prev.t2 + (newVote.pick === 2 ? 1 : 0),
        }));
      },
      (oldVote) => {
        if (profileId && oldVote.user_id === profileId) return; // Handled optimistically
        setTally(prev => ({
          t1: Math.max(0, prev.t1 - (oldVote.pick === 1 ? 1 : 0)),
          t2: Math.max(0, prev.t2 - (oldVote.pick === 2 ? 1 : 0)),
        }));
      }
    );

    return () => { unsubscribe(); };
  }, [matchId, profileId]);

  const totalVotes = tally.t1 + tally.t2;
  const voteT1Pct = totalVotes === 0 ? 50 : Math.round((tally.t1 / totalVotes) * 100);
  const voteT2Pct = totalVotes === 0 ? 50 : 100 - voteT1Pct;

  const shouldShowResults = isResultsRevealed;

  return (
    <div className={compact ? "mt-1" : "pt-2 border-t border-border-strong/50 mt-2"}>
      {myPick || hasStarted ? (
        <>
          <div className="flex items-center justify-between">
            {myPick && (
              <div className={`flex flex-1 items-center gap-1.5 bg-individual/10 rounded-lg px-2 ${compact ? "py-1" : "py-1.5"}`}>
                <Check className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-individual shrink-0`} />
                <p className={`${compact ? "text-[10px]" : "text-xs"} text-individual font-bold leading-snug line-clamp-1`}>
                  Picked <strong>{myPick === 1 ? t1Label : t2Label}</strong>
                </p>
              </div>
            )}
            
            {isAdmin && onToggleRevealResults && (
              <button
                onClick={onToggleRevealResults}
                className={`ml-2 font-bold text-warning hover:text-warning/80 inline-flex items-center justify-center uppercase tracking-wider transition shrink-0 ${compact ? "text-[9px]" : "text-[10px]"}`}
              >
                {isResultsRevealed ? "Hide Results" : "Reveal"}
              </button>
            )}
          </div>
          
          {!myPick && hasStarted && !compact && (
            <p className="text-xs text-muted-foreground italic mb-2 mt-1">Voting closed (Match has started)</p>
          )}

          {shouldShowResults ? (
            <>
              {totalVotes === 0 ? (
                <p className={`${compact ? "text-[10px] mt-1" : "text-xs mt-2"} text-center text-muted-foreground font-medium`}>No votes yet</p>
              ) : (
              <ProbBar
                t1Pct={voteT1Pct}
                t2Pct={voteT2Pct}
                t1Label={compact ? `${voteT1Pct}%` : `${voteT1Pct}% • ${t1Label}`}
                t2Label={compact ? `${voteT2Pct}%` : `${t2Label} • ${voteT2Pct}%`}
                tooltip={compact ? undefined : "Live predictions from people in the community watching this match."}
              />
              )}
            </>
          ) : (
            <div className={`${compact ? "mt-1 py-1 px-2 text-[9px]" : "mt-2 p-2.5 text-[11px]"} rounded-xl bg-muted/60 border border-border-strong/50 text-muted-foreground flex items-center justify-between font-medium`}>
              <span className="flex items-center gap-1.5 line-clamp-1">
                🔒 Poll results will be revealed when match umpiring starts or when released by admin.
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col">
          {!compact && (
            <p className="text-[11px] text-center font-black text-muted-foreground mb-2 flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-individual" /> Predict the winner!
            </p>
          )}
          <div className={`flex ${compact ? "gap-1.5 flex-row" : "gap-2 flex-col sm:flex-row"}`}>
            <button
              onClick={() => {
                setTally(prev => ({ ...prev, t1: prev.t1 + 1 }));
                onPick(1);
              }}
              className={`flex-1 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary font-black text-primary transition overflow-hidden ${compact ? "py-1 px-1.5 text-[9px] sm:text-[10px] min-h-[1.75rem]" : "p-2 text-xs sm:text-sm min-h-[4.5rem] rounded-xl"}`}
            >
              <span className={`line-clamp-2 break-words ${compact ? "leading-none" : "leading-tight"}`}>{t1Label}</span>
            </button>
            <button
              onClick={() => {
                setTally(prev => ({ ...prev, t2: prev.t2 + 1 }));
                onPick(2);
              }}
              className={`flex-1 flex items-center justify-center rounded-lg bg-info/10 hover:bg-info/10 border border-info/40 font-black text-info transition overflow-hidden ${compact ? "py-1 px-1.5 text-[9px] sm:text-[10px] min-h-[1.75rem]" : "p-2 text-xs sm:text-sm min-h-[4.5rem] rounded-xl"}`}
            >
              <span className={`line-clamp-2 break-words ${compact ? "leading-none" : "leading-tight"}`}>{t2Label}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { PredictionLeaderboard } from "./PredictionLeaderboard";

export function MatchPredictions() {
  const { profile, isAdmin } = useAuth();
  const [liveMatches, setLiveMatches] = useState<BwfMatchState[]>([]);
  const [picks, setPicks] = useState<Record<string, 1 | 2>>({});
  const [revealedMatchIds, setRevealedMatchIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"predictions" | "leaderboard">("predictions");

  useEffect(() => {
    const parse = (val: Record<string, BwfMatchState>) => {
      let killed = [];
      try {
        killed = JSON.parse(sessionStorage.getItem("killed_match_ids") || "[]");
      } catch {
        /* intentional — fallback to empty array if sessionStorage unavailable or invalid */
      }
      const killedMatchIds = new Set(killed);
      setLiveMatches(Object.values(val).filter((m) => {
        // Don't show matches that were just killed
        if (killedMatchIds.has(m.id)) return false;
        return m.status === "playing" || (m.status === "setup" && m.t1.p1Id && m.t2.p1Id);
      }));
    };

    umpireService.fetchLiveMatchesRegistry().then((val) => {
      if (val) parse(val);
    });

    const unsubLive = umpireService.subscribeToLiveMatchesRegistry((val) => {
      if (val) parse(val);
    });

    feedService.getPollRevealedMatches().then((val) => {
      if (val) setRevealedMatchIds(val);
    });

    const unsubRevealed = feedService.subscribeToPollRevealedMatches((val) => {
      if (val) setRevealedMatchIds(val);
    });

    return () => {
      unsubLive();
      unsubRevealed();
    };
  }, []);

  const toggleRevealMatchPoll = async (matchId: string) => {
    const nextState = { ...revealedMatchIds, [matchId]: !revealedMatchIds[matchId] };
    setRevealedMatchIds(nextState);
    await feedService.setPollRevealedMatches(nextState);
  };

  // Load picks from DB on mount
  useEffect(() => {
    if (!profile?.id || liveMatches.length === 0) return;
    const ids = liveMatches.map(m => m.id);
    feedService.getLiveMatchPicks(profile.id, ids).then((map) => {
      setPicks(map);
    });
  }, [profile?.id, liveMatches.map(m => m.id).join(",")]);

  const pick = async (matchId: string, team: 1 | 2) => {
    if (!profile?.id || picks[matchId]) return;
    setPicks(prev => ({ ...prev, [matchId]: team }));
    try {
      await feedService.saveLiveMatchPick(matchId, profile.id, team);
    } catch (error: any) {
      if (error?.code === '23505') { // 23505 is unique_violation
        toast.success("Your vote is already recorded!");
      } else {
        toast.error(`Failed to submit vote: ${error.message}`);
        setPicks(prev => { const next = { ...prev }; delete next[matchId]; return next; });
      }
    }
  };

  if (liveMatches.length === 0) return null;

  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-individual" />
          <h3 className="font-black text-foreground">Who's going to win?</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("predictions")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "predictions"
                ? "bg-muted-strong text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Matches
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              activeTab === "leaderboard"
                ? "bg-individual text-individual-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {activeTab === "leaderboard" ? (
        <div className="p-4">
          <PredictionLeaderboard />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {liveMatches.map((m) => (
            <MatchPredictionCard
              key={m.id}
              matchId={m.id}
              t1Label={m.t1.p2Name ? `${m.t1.p1Name} & ${m.t1.p2Name}` : m.t1.p1Name}
              t2Label={m.t2.p2Name ? `${m.t2.p1Name} & ${m.t2.p2Name}` : m.t2.p1Name}
              hasStarted={m.status === "playing"}
              myPick={picks[m.id]}
              profileId={profile?.id}
              onPick={(team) => pick(m.id, team)}
              isResultsRevealed={!!revealedMatchIds[m.id]}
              isAdmin={isAdmin}
              onToggleRevealResults={() => toggleRevealMatchPoll(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


