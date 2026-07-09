import { UmpireSetupFlow } from "./UmpireSetupFlow";
import { PlayerSelect } from "./PlayerSelect";
import { ScoringLogic, type MatchFormat } from "@/lib/umpire/scoringLogic";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Trophy, Activity, Plus, Minus, X, Settings, Save, Timer, Play,
  AlertTriangle, BookOpen, ArrowLeftRight, Flag, ChevronDown, ChevronUp, Repeat, Tv2, MonitorPlay, ActivitySquare
} from "lucide-react";
import { toast } from "sonner";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { Capacitor } from "@capacitor/core";
import FloatingScore from "@/lib/floatingScore";
import { UmpireBackground } from "@/lib/umpireBackground";
import { Pip } from "@/lib/pip";
import { PlayerMotion, type MotionData } from "@/lib/playerMotion";
import { WidgetManager } from "@/lib/widgetManager";

// ── Types ─────────────────────────────────────────────────────────────────────

import type { PlayerSlim as Player } from "@/types";

// Shape of a DB match row passed into edit mode (distinct from BwfMatchState)
export type MatchEditState = {
  is_edit_mode: true;
  id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id?: string | null;
  team2_partner_id?: string | null;
  winner_id?: string | null;
  score?: string | null;
  match_score?: string | null;
  round?: string | null;
  is_friendly?: boolean | null;
  category?: string;
  sets_history?: string[] | null;
  player1?: { full_name: string } | null;
  player2?: { full_name: string } | null;
  partner1?: { full_name: string } | null;
  partner2?: { full_name: string } | null;
  team1_label?: string | null;
  team2_label?: string | null;
};

export type PointLogEntry = {
  gameNum: number;
  team: 1 | 2 | "let" | "fault";
  t1Score: number;
  t2Score: number;
  serverTeam: 1 | 2;
  note?: string;
  ts: number;
};

export type BwfMatchState = {
  id: string;
  umpireName: string;
  isFriendly: boolean;
  matchNumber?: string;
  category: string;
  inferredCategory?: string;
  customCategory?: string;
  dbId?: string;
  pointsToWin: number;
  bestOfSets: number;
  goldenPoint: number;
  t1: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  t2: { p1Id: string; p1Name: string; p2Id?: string; p2Name?: string; score: number; games: number };
  serverTeam: 1 | 2;
  serverPlayerIndex: 0 | 1;
  receiverPlayerIndex: 0 | 1;
  receiverP0AtTop: boolean;
  t1LastServedBy: 0 | 1;
  t2LastServedBy: 0 | 1;
  endsSwapped: boolean;
  pointLog: PointLogEntry[];
  status: "setup" | "playing" | "finished";
  winner?: 1 | 2;
  retiredTeam?: 1 | 2;
  setsHistory: string[];
};

type CardType = "yellow" | "red" | "black";
type CardTarget = "t1p1" | "t1p2" | "t2p1" | "t2p2";

import { CourtVisual } from "./CourtVisual";
import { ChangeEndsModal, DisciplineCardModal, RetireModal, DirectScoreModal, ConfirmActionModal } from "./MatchModals";
import { useUmpireState } from "@/hooks/useUmpireState";

// ── Player Select ─────────────────────────────────────────────────────────────


// ── UmpireEngine ──────────────────────────────────────────────────────────────

import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";

export function UmpireEngine({
  userId,
  userEmail,
  userName,
  isTournamentUmpire = false,
  onClose,
  initialMatchState,
  tournamentMatch,
}: {
  userId: string;
  userEmail: string;
  userName: string;
  isTournamentUmpire?: boolean;
  onClose: () => void;
  initialMatchState?: BwfMatchState | MatchEditState | null;
  tournamentMatch?: TournamentMatchForUmpire | null;
}) {
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void; confirmLabel?: string; confirmColor?: string } | null>(null);

  const [isScorePinned, setIsScorePinned] = useState(false);
  const [isMotionTracking, setIsMotionTracking] = useState(false);
  const [motionData, setMotionData] = useState<MotionData | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isMotionTracking) return;
    
    PlayerMotion.startTracking().catch(console.error);
    const listener = PlayerMotion.addListener("onMotionUpdate", (data) => {
      setMotionData(data);
    });

    return () => {
      PlayerMotion.stopTracking().catch(console.error);
      listener.then(l => l.remove()).catch(console.error);
    };
  }, [isMotionTracking]);

  const togglePinScore = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error("Floating score is only available on Android");
      return;
    }
    try {
      if (isScorePinned) {
        await FloatingScore.stopService();
        setIsScorePinned(false);
      } else {
        const { granted } = await FloatingScore.checkPermission();
        if (!granted) {
          const res = await FloatingScore.requestPermission();
          if (!res.granted) {
            toast.error("Permission required. Please enable 'Display over other apps' in Settings.", { duration: 5000 });
            return;
          }
        }
        
        // Wait for service to start with initial score
        const scoreStr = `${match.t1.score} - ${match.t2.score}`;
        await FloatingScore.startService({ score: scoreStr });
        setIsScorePinned(true);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to pin score: " + e.message);
      setIsScorePinned(false);
    }
  };

  const umpireState = useUmpireState({
    userId,
    userEmail,
    userName,
    isTournamentUmpire,
    friendlyOnly: !isAdminEmail(userEmail) && !isTournamentUmpire,
    initialMatchState,
    tournamentMatch,
    onClose
  });

  const {
    players, match, cards, showLog, showChangeEnds, changeEndsReason,
    pendingBreakAfterEnds, showCardPanel, cardTarget, showRetireModal,
    isEditSetupOpen, showToolsMenu, isDirectScoreOpen, showFullTimer,
    directSetsText, directWinner, myBuddies, breakSecondsLeft, breakTotalSeconds, breakLabel,
    setPlayers, setMatch, setCards, setShowLog, setShowChangeEnds, setChangeEndsReason,
    setPendingBreakAfterEnds, setShowCardPanel, setCardTarget, setShowRetireModal,
    setIsEditSetupOpen, setShowToolsMenu, setIsDirectScoreOpen, setShowFullTimer,
    setDirectSetsText, setDirectWinner, setBreakSecondsLeft, setBreakLabel,
    updateMatch, startMatch, startTournamentMatch, handleEditSet, addPoint, deductPoint, forceEndSet,
    confirmChangeEnds, callLet, callServiceFault, issueCard, retireTeam, saveMatchToProfile,
    handleClose, getName, getGender, deduceCategory, startBreak, endBreak,
    selectedPlayerIds, buddyCheckPassed, isDoubles, serverName, receiverName,
    currentGameNum, serverScore, receiverScore, cardBadge
  } = umpireState;

  // Render variables
  const friendlyOnly = !isAdminEmail(userEmail) && !isTournamentUmpire;

  // Sync score when match state changes
  useEffect(() => {
    if (isScorePinned && Capacitor.isNativePlatform() && match) {
      const scoreStr = `${match.t1.score} - ${match.t2.score}`;
      FloatingScore.updateScore({ score: scoreStr }).catch(() => {
        setIsScorePinned(false);
      });
    }
  }, [match?.t1.score, match?.t2.score, isScorePinned]);

  // Cleanup floating widget on unmount
  useEffect(() => {
    return () => {
      if (isScorePinned && Capacitor.isNativePlatform()) {
        FloatingScore.stopService().catch(() => {});
      }
    };
  }, [isScorePinned]);

  // ── Native Background Service & Lock Screen (Phase 2) ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || match?.status !== "playing") return;
    
    // Auto-start the background keep-alive service
    UmpireBackground.startService().catch(console.error);
    
    // Listen for Lock Screen / Notification +1 Point Actions
    const listenerPromise = UmpireBackground.addListener("umpireAction", (info) => {
      if (info.team === 1 || info.team === 2) {
        addPoint(info.team);
      }
    });
    
    return () => {
      UmpireBackground.stopService().catch(console.error);
      listenerPromise.then(l => l.remove()).catch(console.error);
    };
  }, [match?.status, match?.id, addPoint]);

  // Sync background notification score and Widget
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || match?.status !== "playing") return;
    const scoreStr = `${match.t1.score} - ${match.t2.score}`;
    const t1Label = match.t1.teamName || match.t1.p1Name;
    const t2Label = match.t2.teamName || match.t2.p1Name;
    UmpireBackground.updateScore({ score: scoreStr, teams: `${t1Label} vs ${t2Label}` }).catch(console.error);
    
    // Also push to Home Screen Widget
    WidgetManager.updateWidget({
      title: match.tournament || "IISc Badminton",
      team1: t1Label,
      score1: String(match.t1.score),
      team2: t2Label,
      score2: String(match.t2.score),
    }).catch(console.error);
  }, [match?.t1.score, match?.t2.score, match?.status]);

  // ── TOURNAMENT SETUP SCREEN ────────────────────────────────────────────────
  // Shown instead of UmpireSetupFlow when a tournament match is pre-filled.
  const renderTournamentSetup = () => {
    if (!tournamentMatch) return null;
    const tm = tournamentMatch;
    const isDoublesMatch = ["MD", "WD", "XD"].includes(tm.category);
    const CAT_BADGE: Record<string, string> = {
      MS: "bg-blue-600", WS: "bg-pink-600", MD: "bg-primary",
      WD: "bg-purple-600", XD: "bg-orange-600",
    };
    const badgeCls = CAT_BADGE[tm.category] ?? "bg-slate-600";

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-4xl p-5 sm:p-6 text-foreground max-w-lg mx-auto shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-primary to-sky-500 rounded-t-4xl" />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg text-foreground ${badgeCls}`}>{tm.category}</span>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{tm.round_name} · {tm.match_code}</span>
            </div>
            <p className="text-xs text-muted-foreground font-bold">{tm.tournament_name}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-xl text-muted-foreground hover:text-foreground transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-6">
          <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700 text-center">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Team 1</p>
            <p className="text-foreground font-black text-sm leading-snug">{tm.team1_label ?? "TBD"}</p>
          </div>
          <span className="text-[10px] font-black text-rose-400">VS</span>
          <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700 text-center">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Team 2</p>
            <p className="text-foreground font-black text-sm leading-snug">{tm.team2_label ?? "TBD"}</p>
          </div>
        </div>

        {/* Scoring config (editable) */}
        <div className="bg-slate-800/60 rounded-2xl p-4 space-y-3 mb-5 border border-slate-700/50">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Scoring Rules</p>
          <div className="flex gap-2">
            {[1, 3, 5].map((sets) => (
              <button key={sets}
                onClick={() => setMatch({ ...match, bestOfSets: sets })}
                className={`flex-1 py-2 rounded-xl font-black text-sm border transition ${match.bestOfSets === sets ? "bg-sky-500/20 border-sky-500 text-sky-400" : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"}`}>
                BO{sets}
              </button>
            ))}
            <div className="w-px bg-slate-700 self-stretch mx-1" />
            {[11, 15, 21].map((pts) => (
              <button key={pts}
                onClick={() => setMatch({ ...match, pointsToWin: pts, goldenPoint: pts === 21 ? 30 : pts === 15 ? 21 : 15 })}
                className={`flex-1 py-2 rounded-xl font-black text-sm border transition ${match.pointsToWin === pts ? "bg-primary/20 border-primary text-primary" : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"}`}>
                {pts}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">Golden point cap:</span>
            <input type="number" value={match.goldenPoint}
              onChange={(e) => setMatch({ ...match, goldenPoint: parseInt(e.target.value) || 30 })}
              className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-center text-sm font-bold text-amber-400 outline-none focus:border-amber-500 transition" />
            <span className="text-xs text-muted-foreground">pts</span>
          </div>
        </div>

        {/* Server selection */}
        <div className="bg-slate-800/60 rounded-2xl p-4 space-y-3 mb-6 border border-slate-700/50">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Who Serves First?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { team: 1, label: tm.team1_label ?? "Team 1" },
              { team: 2, label: tm.team2_label ?? "Team 2" },
            ].map(({ team, label }) => (
              <button key={team}
                onClick={() => setMatch({ ...match, serverTeam: team as 1 | 2, serverPlayerIndex: 0 })}
                className={`py-3 px-3 rounded-xl font-black text-sm border transition text-center ${
                  match.serverTeam === team
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                }`}>
                {label}
              </button>
            ))}
          </div>
          {isDoublesMatch && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[0, 1].map((idx) => {
                const serving = match.serverTeam === 1;
                const teamLabel = serving ? tm.team1_label : tm.team2_label;
                const names = (teamLabel ?? "").split(/[&,]/).map((s) => s.trim());
                const name = names[idx] ?? `Player ${idx + 1}`;
                return (
                  <button key={idx}
                    onClick={() => setMatch({ ...match, serverPlayerIndex: idx as 0 | 1 })}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition ${
                      match.serverPlayerIndex === idx
                        ? "bg-sky-500/20 border-sky-500 text-sky-400"
                        : "bg-slate-700/50 border-slate-700 text-muted-foreground hover:border-slate-500"
                    }`}>
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Start */}
        <button
          onClick={startTournamentMatch}
          className="w-full py-4 rounded-2xl bg-primary hover:bg-primary text-primary-foreground font-black text-lg transition shadow-lg shadow-primary/50/30 flex items-center justify-center gap-2">
          <Play className="w-5 h-5 fill-white" /> Start Match
        </button>
      </div>
    );
  };

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  const renderSetupContent = () => (
    <UmpireSetupFlow
      match={match}
      setMatch={setMatch}
      players={players}
      friendlyOnly={friendlyOnly}
      isEditSetupOpen={isEditSetupOpen}
      setIsEditSetupOpen={setIsEditSetupOpen}
      handleClose={handleClose}
      getName={getName}
      deduceCategory={deduceCategory}
      startMatch={startMatch}
      buddyCheckPassed={buddyCheckPassed}
      selectedPlayerIds={selectedPlayerIds}
    />
  );
  const renderSetupOverlay = () => {
    if (!isEditSetupOpen) return null;
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={() => setIsEditSetupOpen(false)}
      >
        <div className="w-full max-w-xl my-8" onClick={e => e.stopPropagation()}>
          {renderSetupContent()}
        </div>
      </div>
    );
  };

  // ── SETUP SCREEN (INITIAL) ─────────────────────────────────────────────────
  if (match.status === "setup") {
    return (
      <div className="relative max-w-xl mx-auto">
        {tournamentMatch ? renderTournamentSetup() : renderSetupContent()}
      </div>
    );
  }

  // ── PLAYING / FINISHED SCREEN ──────────────────────────────────────────────
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-4xl p-4 sm:p-6 text-foreground max-w-4xl lg:max-w-5xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-primary to-sky-500" />
      {renderSetupOverlay()}
      {/* ── Change Ends Overlay ── */}
      {showChangeEnds && (
        <ChangeEndsModal reason={changeEndsReason} onConfirm={confirmChangeEnds} />
      )}

      {/* ── Cards Panel Overlay ── */}
      {showCardPanel && (
        <DisciplineCardModal 
          match={match} 
          cards={cards} 
          cardTarget={cardTarget} 
          setCardTarget={setCardTarget} 
          onClose={() => { setShowCardPanel(false); setCardTarget(null); }} 
          onIssueCard={issueCard} 
        />
      )}

      {/* ── Retirement Modal ── */}
      {showRetireModal && (
        <RetireModal match={match} onRetire={retireTeam} onClose={() => setShowRetireModal(false)} />
      )}

      {/* ── Direct Score Modal ── */}
      {isDirectScoreOpen && (
        <DirectScoreModal 
          directWinner={directWinner} 
          setDirectWinner={setDirectWinner} 
          directSetsText={directSetsText} 
          setDirectSetsText={setDirectSetsText} 
          onSave={() => {
            updateMatch({ status: "finished", winner: directWinner, setsHistory: directSetsText.split(",").map(s => s.trim()).filter(s => s !== "0-0" && s !== "-") });
            setIsDirectScoreOpen(false);
          }} 
          onClose={() => setIsDirectScoreOpen(false)} 
          match={match}
        />
      )}

      {confirmAction && (
        <ConfirmActionModal 
          {...confirmAction} 
          onClose={() => setConfirmAction(null)} 
        />
      )}

      {/* ── Header ── */}
      <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 mb-4">
        {match.status === "playing" && (
          <>
            <button onClick={() => updateMatch({ endsSwapped: !match.endsSwapped })} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
              <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> Swap Ends
            </button>
            {match.t1.p2Id && (
              <button onClick={() => updateMatch({ serverPlayerIndex: match.serverPlayerIndex === 0 ? 1 : 0 })} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
                <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> Switch Server
              </button>
            )}
            <button onClick={() => setIsDirectScoreOpen(true)} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> Direct Score
            </button>
            <button onClick={() => setIsEditSetupOpen(true)} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> Edit Setup
            </button>
            {Capacitor.isNativePlatform() && (
              <>
                <button onClick={togglePinScore} className={`shrink-0 px-1 py-2 sm:px-3 sm:py-2 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border transition ${isScorePinned ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"}`}>
                  <Tv2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {isScorePinned ? "Unpin Score" : "Pin Score"}
                </button>
                <button onClick={() => Pip.enterPipMode()} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
                  <MonitorPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" /> PiP
                </button>
                <button onClick={() => setIsMotionTracking(m => !m)} className={`shrink-0 px-1 py-2 sm:px-3 sm:py-2 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border transition ${isMotionTracking ? "bg-green-600 border-green-500 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"}`}>
                  <ActivitySquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {isMotionTracking ? motionData?.intensity || "Tracking..." : "Track Motion"}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Finished Screen ── */}
      {match.status === "finished" ? (
        <div className="text-center py-12">
          <Trophy className="w-20 h-20 mx-auto text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
          <h2 className="text-3xl font-black mb-2">Match {match.retiredTeam ? "Retired" : "Finished"}!</h2>
          <div className="text-xs font-bold text-muted-foreground mb-4 tracking-widest uppercase">
            {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts)
          </div>
          <p className="text-xl text-slate-300 mb-2">
            {match.winner === 1
              ? (match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : ""))
              : (match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : ""))
            } Won
          </p>
          <p className="text-primary font-bold mb-8 text-2xl">{match.setsHistory.join(", ")}{match.retiredTeam ? ` (T${match.retiredTeam} Retired)` : ""}</p>
          <button onClick={saveMatchToProfile} className="px-6 py-4 bg-linear-to-r from-amber-500 to-orange-500 text-foreground rounded-2xl font-black uppercase tracking-wider shadow-xl flex items-center gap-2 mx-auto">
            <Save className="w-5 h-5" /> Save to Profile & Notify
          </button>
          <button onClick={() => updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined })} className="mt-6 text-sm font-bold text-muted-foreground hover:text-muted-foreground underline">
            Wait, add a set / resume match
          </button>
        </div>
      ) : (
        <>
        <div className="flex items-center justify-between gap-3 mb-4 mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-primary font-black uppercase tracking-widest text-xs mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live Umpire
            </div>
            <div className="text-muted-foreground text-[11px] font-bold truncate">
              {match.isFriendly ? "Friendly" : `Tournament • ${match.matchNumber || "—"}`} • {match.inferredCategory || match.category} • BO{match.bestOfSets} ({match.pointsToWin}pts) • Game {currentGameNum}
            </div>
          </div>
        </div>

        {/* ── Break Timer Banner (always visible when timer running) ── */}
        {breakSecondsLeft !== null && (
          <div className="w-full flex flex-col px-4 py-3 bg-amber-400/10 border border-amber-400/40 rounded-2xl mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-amber-400 font-black text-sm uppercase tracking-widest">{breakLabel || "Break"}</span>
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Elapsed: {
                    (() => {
                      const elapsed = (breakTotalSeconds ?? breakSecondsLeft) - breakSecondsLeft;
                      return `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;
                    })()
                  }
                </div>
              </div>
              <span className={`font-black text-2xl tabular-nums ${breakSecondsLeft < 0 ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-amber-400'}`}>
                {breakSecondsLeft < 0 ? "-" : ""}
                {Math.floor(Math.abs(breakSecondsLeft) / 60).toString().padStart(2, "0")}:{(Math.abs(breakSecondsLeft) % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="flex justify-center">
              <button onClick={endBreak} className="w-full sm:w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition">
                End Break
              </button>
            </div>
          </div>
        )}

        <>
          {/* ── Score Cards (HERO — tap card to add a point) ── */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6">
            {([1, 2] as const).map((team) => {
              const t = team === 1 ? match.t1 : match.t2;
              const isServing = match.serverTeam === team;
              const scoreColor = team === 1 ? "text-primary/70" : "text-sky-300";
              const servingText = team === 1 ? "text-primary" : "text-sky-400";
              const servingDot = team === 1 ? "bg-primary" : "bg-sky-400";
              const order = team === 1 ? (match.endsSwapped ? 2 : 1) : (match.endsSwapped ? 1 : 2);
              return (
                <div
                  key={team}
                  onClick={() => addPoint(team)}
                  style={{ order }}
                  className={`relative cursor-pointer select-none active:scale-[0.97] rounded-3xl border-2 p-3 sm:p-5 md:p-7 flex flex-col items-center transition-all ${
                    isServing
                      ? team === 1
                        ? "bg-primary/10 border-primary shadow-[0_0_30px_rgba(16,185,129,0.25)]"
                        : "bg-sky-500/10 border-sky-500 shadow-[0_0_30px_rgba(14,165,233,0.25)]"
                      : "bg-slate-800/40 border-slate-700/70"
                  }`}
                >
                  {/* Minus (corner) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deductPoint(team); }}
                    className="absolute top-2 left-2 w-9 h-9 rounded-xl bg-slate-900/70 hover:bg-slate-700 flex items-center justify-center border border-slate-700 z-10"
                    aria-label="Deduct point"
                  >
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  </button>

                  {/* Names */}
                  <div className="text-center px-7 w-full min-w-0">
                    <h3 className="text-xs sm:text-base md:text-xl font-black truncate leading-tight w-full">
                      {t.p1Name}{cardBadge(team === 1 ? "t1p1" : "t2p1")}
                    </h3>
                    {t.p2Name && (
                      <h3 className="text-xs sm:text-base md:text-xl font-black truncate leading-tight w-full">
                        {t.p2Name}{cardBadge(team === 1 ? "t1p2" : "t2p2")}
                      </h3>
                    )}
                  </div>

                  {/* S / R indicator */}
                  <div className="h-4 md:h-5 mt-0.5 mb-1 flex items-center justify-center">
                    {isServing ? (
                      <span className={`flex items-center gap-1 ${servingText} text-[11px] md:text-sm font-black uppercase tracking-wide`}>
                        <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${servingDot} animate-pulse`} /> S · Serving
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-[11px] md:text-sm font-black uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-400" /> R · Receiving
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <div className={`text-[4.5rem] sm:text-[7rem] md:text-[9rem] leading-none font-black tracking-tighter tabular-nums drop-shadow-md ${scoreColor}`}>
                    {t.score}
                  </div>

                  {/* Games won */}
                  <div className="mt-2 flex justify-center gap-1.5">
                    {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${i < t.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`} />
                    ))}
                  </div>

                  {/* Tap hint */}
                  <div className="mt-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Plus className="w-2.5 h-2.5" /> Tap to score
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Score Announcement (server-first, BWF style) ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-4 text-[11px] font-black uppercase tracking-widest">
            <span className="text-primary">{serverName}</span>
            <span className="text-primary text-base tabular-nums">{serverScore}</span>
            <span className="text-muted-foreground">—</span>
            <span className="text-slate-300 text-base tabular-nums">{receiverScore}</span>
            <span className="text-muted-foreground">{receiverName}</span>
            <span className="text-[10px] font-bold text-muted-foreground ml-1">({match.setsHistory.length > 0 ? match.setsHistory.join(", ") + " | " : ""}G{currentGameNum})</span>
          </div>

          {/* ── Court Visual ── */}
          <div className="flex justify-center mt-3">
            <CourtVisual
              serverTeam={match.serverTeam}
              serverPlayerIndex={match.serverPlayerIndex}
              receiverP0AtTop={match.receiverP0AtTop}
              t1Name={match.t1.p1Name}
              t2Name={match.t2.p1Name}
              t1P2Name={match.t1.p2Name}
              t2P2Name={match.t2.p2Name}
              t1Score={match.t1.score}
              t2Score={match.t2.score}
              isDoubles={!!match.t1.p2Id}
              endsSwapped={match.endsSwapped}
            />
          </div>

          {/* ── Break shortcuts ── */}
          <div className="mt-5">
            <div className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:hidden">Break Timers</div>
            <div className="grid grid-cols-2 sm:flex gap-2 justify-center">
              <span className="hidden sm:inline-flex text-[10px] font-bold text-muted-foreground uppercase tracking-widest self-center mr-1">Break:</span>
              {[["30s", 30, "Short Break"], ["1 min", 60, "1-min Interval"], ["90s", 90, "Set 1→2 Interval"], ["2 min", 120, "Set 2→3 Interval"]].map(([label, secs, lbl]) => (
                <button key={label as string} onClick={() => startBreak(secs as number, lbl as string)}
                  className={`px-2.5 py-2 font-bold text-xs rounded-xl transition-all flex justify-center items-center gap-1.5 shadow-sm ${
                    label === "1 min"
                      ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                      : "bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300"
                  }`}>
                  <Timer className="w-3.5 h-3.5" />{label as string}
                </button>
              ))}
            </div>
          </div>

          {/* ── Action Bar ── */}
          <div className="mt-3 grid grid-cols-3 sm:flex sm:flex-wrap sm:justify-center gap-2">
            <button onClick={forceEndSet}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-primary/20 border border-slate-700 hover:border-primary/50 text-slate-300 hover:text-primary/70 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Set
            </button>
            <button onClick={callLet}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-blue-500/20 border border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              ↩ Let
            </button>
            <button onClick={() => callServiceFault(match.serverTeam)}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-orange-500/20 border border-slate-700 hover:border-orange-500/50 text-slate-300 hover:text-orange-300 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              ✗ Fault
            </button>
            <button onClick={() => { setShowCardPanel(true); setCardTarget(null); }}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-yellow-500/20 border border-slate-700 hover:border-yellow-500/50 text-slate-300 hover:text-yellow-300 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Cards
            </button>
            <button onClick={() => setShowRetireModal(true)}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Retire
            </button>
            <button onClick={() => setShowLog(!showLog)}
              className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl transition flex justify-center items-center gap-1 sm:gap-1.5">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Log ({match.pointLog.length})
            </button>
          </div>
        </>
        </>
      )}

      {/* ── Sets History & Editing ── */}
          {match.setsHistory.length > 0 && (
            <div className="mt-8 bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-800/80 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-700 font-black"></th>
                    <th className="px-4 py-3 border-b border-slate-700 text-center font-black text-primary">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="whitespace-nowrap">{match.t1.p1Name}</span>
                        {match.t1.p2Name && <span className="whitespace-nowrap">& {match.t1.p2Name}</span>}
                      </div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-700 text-center font-black text-sky-400">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="whitespace-nowrap">{match.t2.p1Name}</span>
                        {match.t2.p2Name && <span className="whitespace-nowrap">& {match.t2.p2Name}</span>}
                      </div>
                    </th>
                    <th className="px-4 py-3 border-b border-slate-700 font-black text-center text-amber-400">Winner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {match.setsHistory.map((setStr, i) => {
                    const [s1, s2] = setStr.split("-");
                    const n1 = parseInt(s1);
                    const n2 = parseInt(s2);
                    const t1Won = n1 > n2;
                    const t2Won = n2 > n1;
                    const winnerStr = t1Won 
                      ? match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")
                      : t2Won 
                        ? match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")
                        : "-";

                    return (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-muted-foreground whitespace-nowrap">Set {i + 1}</td>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="text" 
                            maxLength={2}
                            value={s1} 
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                              handleEditSet(i, capped, s2);
                            }}
                            className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-center font-bold text-primary outline-none focus:border-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="text" 
                            maxLength={2}
                            value={s2} 
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                              handleEditSet(i, s1, capped);
                            }}
                            className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-center font-bold text-sky-400 outline-none focus:border-sky-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs text-muted-foreground text-center">{winnerStr}</td>
                      </tr>
                    );
                  })}
                  {!!match.winner && (
                    <tr className="bg-primary/80/20">
                      <td colSpan={1 + (match.t1.p2Id ? 2 : 1) + (match.t2.p2Id ? 2 : 1)} className="px-4 py-4 font-black text-amber-500 text-right pr-6 uppercase tracking-widest text-xs">
                        Match Winner
                      </td>
                      <td className="px-4 py-4 font-black text-amber-400 text-center">
                        {match.winner === 1 
                          ? match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")
                          : match.winner === 2 
                            ? match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")
                            : "-"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Point-by-Point Log ── */}
          {showLog && (
            <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Match Log</span>
                <span className="text-xs text-muted-foreground">{match.pointLog.length} events</span>
              </div>
              {match.pointLog.length === 0 ? (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">No points logged yet</div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {[...match.pointLog].reverse().map((entry, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${
                          entry.team === 1 ? "text-primary"
                          : entry.team === 2 ? "text-sky-400"
                          : entry.team === "let" ? "text-blue-400"
                          : "text-orange-400"
                        }`}>
                          {entry.team === 1 ? "T1 +" : entry.team === 2 ? "T2 +" : entry.team === "let" ? "LET" : "FAULT"}
                        </span>
                        {entry.note && <span className="text-muted-foreground">{entry.note}</span>}
                        <span className="text-muted-foreground">G{entry.gameNum}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-300 shrink-0">
                        {entry.t1Score} — {entry.t2Score}
                        <span className={`ml-1.5 text-[9px] ${entry.serverTeam === 1 ? "text-primary" : "text-sky-500"}`}>
                          🏸T{entry.serverTeam}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Match Action Buttons (Bottom) ── */}
          {match.status === "playing" && (
            <div className="grid grid-cols-3 gap-2 mt-8 mb-4">
              <button onClick={() => setConfirmAction({
                title: "Cancel Match",
                message: "Are you sure you want to exit without saving? Any unsaved progress will be lost.",
                confirmLabel: "Cancel Match",
                confirmColor: "bg-rose-600 hover:bg-rose-500",
                onConfirm: () => handleClose()
              })} className="px-1 py-3 bg-slate-800 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-rose-500/30 transition shadow-sm">
                <X className="w-4 h-4 sm:w-4 sm:h-4" /> Cancel
              </button>
              <button onClick={() => setConfirmAction({
                title: "Finish Match",
                message: "Are you sure you want to forcefully finish this match?",
                confirmLabel: "Finish Match",
                confirmColor: "bg-primary hover:bg-primary",
                onConfirm: () => updateMatch({ status: 'finished', winner: match.t1.games >= match.t2.games ? 1 : 2 })
              })} className="px-1 py-3 bg-slate-800 hover:bg-primary/20 text-primary font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-primary/30 transition shadow-sm">
                <Save className="w-4 h-4 sm:w-4 sm:h-4" /> Finish
              </button>
              <button onClick={() => setConfirmAction({
                title: "Abort Match",
                message: "Are you sure you want to permanently abort this match and delete its records?",
                confirmLabel: "Abort Match",
                confirmColor: "bg-rose-600 hover:bg-rose-500",
                onConfirm: () => handleClose()
              })} className="px-1 py-3 bg-slate-800 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-rose-500/30 transition shadow-sm">
                <AlertTriangle className="w-4 h-4 sm:w-4 sm:h-4" /> Abort
              </button>
            </div>
          )}
    </div>
  );
}


