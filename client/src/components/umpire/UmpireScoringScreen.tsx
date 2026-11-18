import React, { useState, useEffect, useRef } from "react";
import {
  Trophy, Minus, Plus, Save, RefreshCw, Settings, Shuffle, Timer,
  Repeat, Tv2, Camera, Edit2, Loader2, BookOpen, MoreHorizontal,
  ArrowLeftRight, Flag, AlertTriangle, X, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { umpireService } from "@/services/umpireService";
import { MatchService } from "@/services/matchService";
import type { BwfMatchState, CardType, CardTarget, ScoreConflictState } from "@/types/umpire";
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";
import { CourtVisual } from "./CourtVisual";
import { ChangeEndsModal, DisciplineCardModal, RetireModal, DirectScoreModal, ConfirmActionModal } from "./MatchModals";
import { ScoreConflictModal } from "./ScoreConflictModal";

export interface UmpireScoringScreenProps {
  match: BwfMatchState;
  cards: Record<CardTarget, CardType[]>;
  updateMatch: (patch: Partial<BwfMatchState>) => void;
  addPoint: (team: 1 | 2) => void;
  deductPoint: (team: 1 | 2) => void;
  forceEndSet: () => void;
  reopenSet: (idx: number) => void;
  deleteSet: (idx: number) => void;
  handleEditSet: (idx: number, s1: string, s2: string) => void;
  callLet: () => void;
  callServiceFault: (team: 1 | 2) => void;
  issueCard: (target: CardTarget, cardType: CardType) => void;
  retireTeam: (team: 1 | 2) => void;
  saveMatchToProfile: () => Promise<any>;
  handleClose: (opts?: { endBroadcast?: boolean }) => void;
  startBreak: (secs: number, label: string) => void;
  endBreak: () => void;
  isSaving: boolean;
  hasSaved: boolean;
  isSyncing?: boolean;
  tournamentMatch?: TournamentMatchForUmpire | null;
  offlineSync: {
    isOffline: boolean;
    queuedCount: number;
    syncStatus: "idle" | "saved-locally" | "syncing" | "confirmed" | "error";
  };
  showChangeEnds: boolean;
  changeEndsReason: string;
  changeEndsTitle: string;
  confirmChangeEnds: () => void;
  showCardPanel: boolean;
  setShowCardPanel: (show: boolean) => void;
  cardTarget: CardTarget | null;
  setCardTarget: (target: CardTarget | null) => void;
  showRetireModal: boolean;
  setShowRetireModal: (show: boolean) => void;
  isDirectScoreOpen: boolean;
  setIsDirectScoreOpen: (open: boolean) => void;
  directWinner: 1 | 2 | null;
  setDirectWinner: (w: 1 | 2 | null) => void;
  directSetsText: string;
  setDirectSetsText: (text: string) => void;
  showLog: boolean;
  setShowLog: (show: boolean) => void;
  breakSecondsLeft: number | null;
  breakTotalSeconds: number | null;
  breakLabel: string;
  currentGameNum: number;
  setIsEditSetupOpen: (open: boolean) => void;
  conflictState?: ScoreConflictState | null;
  isResolvingConflict?: boolean;
  canCorrectMatch?: boolean;
  onKeepServerResult?: () => Promise<void> | void;
  onApplyCorrection?: (reason: string) => Promise<void> | void;
  onCloseConflictModal?: () => void;
}

export function UmpireScoringScreen({
  match,
  cards,
  updateMatch,
  addPoint,
  deductPoint,
  forceEndSet,
  reopenSet,
  deleteSet,
  handleEditSet,
  callLet,
  callServiceFault,
  issueCard,
  retireTeam,
  saveMatchToProfile,
  handleClose,
  startBreak,
  endBreak,
  isSaving,
  hasSaved,
  isSyncing = false,
  tournamentMatch,
  offlineSync,
  showChangeEnds,
  changeEndsReason,
  changeEndsTitle,
  confirmChangeEnds,
  showCardPanel,
  setShowCardPanel,
  cardTarget,
  setCardTarget,
  showRetireModal,
  setShowRetireModal,
  isDirectScoreOpen,
  setIsDirectScoreOpen,
  directWinner,
  setDirectWinner,
  directSetsText,
  setDirectSetsText,
  showLog,
  setShowLog,
  breakSecondsLeft,
  breakTotalSeconds,
  breakLabel,
  currentGameNum,
  setIsEditSetupOpen,
  conflictState,
  isResolvingConflict = false,
  canCorrectMatch = false,
  onKeepServerResult,
  onApplyCorrection,
  onCloseConflictModal,
}: UmpireScoringScreenProps) {
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    confirmColor?: string;
  } | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // BWF 25-second rally timer — resets on every point scored
  const [rallyTimer, setRallyTimer] = useState<number | null>(null);
  const prevTotalScore = useRef<number | null>(null);

  useEffect(() => {
    if (!match || match.status !== "playing") {
      setRallyTimer(null);
      return;
    }
    const total = match.t1.score + match.t2.score;
    if (prevTotalScore.current !== null && total !== prevTotalScore.current) {
      setRallyTimer(25);
    }
    prevTotalScore.current = total;
  }, [match?.t1.score, match?.t2.score, match?.status]);

  useEffect(() => {
    if (rallyTimer === null) return;
    const iv = setInterval(() => setRallyTimer((t) => (t ?? 0) - 1), 1000);
    return () => clearInterval(iv);
  }, [rallyTimer !== null]);

  const cardBadge = (target: CardTarget) => {
    const c = cards[target];
    if (!c || !c.length) return null;
    const last = c[c.length - 1];
    return (
      <span
        className={`inline-block w-2.5 h-2.5 rounded-sm ml-1 ${
          last === "yellow" ? "bg-yellow-400" : last === "red" ? "bg-red-500" : "bg-slate-900 border border-white"
        }`}
        title={`${c.length} card(s)`}
      />
    );
  };

  const sideIsDoubles = (side?: { p2Id?: string; p2Name?: string }) => !!(side?.p2Id || side?.p2Name);
  const servingTeamIsDoubles = sideIsDoubles(match?.serverTeam === 1 ? match?.t1 : match?.t2);
  const receivingTeamIsDoubles = sideIsDoubles(match?.serverTeam === 1 ? match?.t2 : match?.t1);

  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800/50 rounded-[2rem] p-3 sm:p-6 text-on-accent max-w-4xl lg:max-w-5xl mx-auto shadow-2xl shadow-black/40 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[var(--info)] to-primary bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite]" />

      {/* ── Change Ends Overlay ── */}
      {showChangeEnds && (
        <ChangeEndsModal reason={changeEndsReason} title={changeEndsTitle} onConfirm={confirmChangeEnds} />
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
            updateMatch({
              status: "finished",
              winner: directWinner,
              setsHistory: directSetsText.split(",").map(s => s.trim()).filter(s => s !== "0-0" && s !== "-"),
            });
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

      {/* ── Score Revision Conflict Modal ── */}
      {conflictState && (
        <ScoreConflictModal
          conflict={conflictState}
          isOpen={Boolean(conflictState)}
          canCorrect={Boolean(canCorrectMatch)}
          isResolving={isResolvingConflict}
          onKeepServerResult={onKeepServerResult || (() => {})}
          onApplyCorrection={onApplyCorrection || (() => {})}
          onClose={onCloseConflictModal || (() => {})}
        />
      )}

      {/* ── Header Area ── */}
      <div className="flex items-start justify-between gap-3 mb-3 mt-2">
        <div className="min-w-0 flex-1">
          {match.status !== "finished" ? (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 backdrop-blur-sm shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-[0.15em]">Live</span>
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Game {currentGameNum}</span>
              </div>
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-bold truncate">
                {match.isFriendly ? "Friendly" : `Tournament · ${match.matchNumber || "—"}`} · {match.inferredCategory || match.category} · BO{match.bestOfSets || 1} ({match.pointsToWin || 30}pts)
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-black text-[var(--success)] uppercase tracking-widest">Match Finished</span>
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-bold truncate">
                {match.isFriendly ? "Friendly" : `Tournament · ${match.matchNumber || "—"}`} · {match.inferredCategory || match.category}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={() => handleClose()}
            className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-white font-bold text-[10px] sm:text-xs rounded-full flex justify-center items-center gap-1.5 border border-slate-700/50 hover:border-slate-600 backdrop-blur-sm transition cursor-pointer shadow-sm"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
          {offlineSync.isOffline && (
            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] sm:text-[10px] rounded-full flex justify-center items-center gap-1.5 animate-pulse backdrop-blur-sm">
              ⚡ Saved on device ({offlineSync.queuedCount})
            </span>
          )}
          {!offlineSync.isOffline && offlineSync.syncStatus === "syncing" && (
            <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold text-[9px] sm:text-[10px] rounded-full">
              Syncing saved score…
            </span>
          )}
          {!offlineSync.isOffline && offlineSync.syncStatus === "error" && (
            <span role="alert" className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold text-[9px] sm:text-[10px] rounded-full">
              Score sync needs retry ({offlineSync.queuedCount})
            </span>
          )}
        </div>
      </div>

      {/* ── Finished Screen ── */}
      {match.status === "finished" ? (
        <div className="text-center py-2">
          <div className="flex flex-col items-center gap-1 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-1 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
              <Trophy className="w-6 h-6 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">{match.retiredTeam ? "Match Retired" : "Match Finished!"}</h2>
          </div>

          <div className="mx-auto max-w-xs mb-4 px-4 py-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20 backdrop-blur-sm">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Winner</div>
            <p className="text-base font-black text-amber-300 leading-tight">
              {match.winner === 1
                ? (match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : ""))
                : (match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : ""))}
            </p>
            <p className="text-[var(--success)] font-black text-sm mt-1 tabular-nums">
              {match.setsHistory.join("  ·  ")}{match.retiredTeam ? ` (T${match.retiredTeam} Retired)` : ""}
            </p>
          </div>

          <div className="flex flex-row items-center justify-center gap-2 max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => {
                setDirectSetsText(match.setsHistory.join(","));
                setDirectWinner(match.winner || null);
                setIsDirectScoreOpen(true);
              }}
              className="flex-1 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-wider border border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5 text-primary" /> Edit Score
            </button>
            <button
              disabled={isSaving}
              onClick={saveMatchToProfile}
              className={`flex-1 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 ${
                hasSaved
                  ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--success)_25%,transparent)]"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]"
              }`}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {isSaving ? "Saving..." : hasSaved ? "Save Again" : "Save Result"}
            </button>
            <button
              disabled={isSaving}
              onClick={() => {
                MatchService.upsertLiveMatch(match.id, match)
                  .then(() => toast.success("Score pushed to Live Feed"))
                  .catch(() => toast.error("Failed to push score"));
              }}
              className="flex-1 px-3 py-2.5 bg-[color-mix(in_srgb,var(--info)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--info)_20%,transparent)] text-[var(--info)] rounded-xl font-bold text-[10px] uppercase tracking-wider border border-[color-mix(in_srgb,var(--info)_20%,transparent)] flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Push Score
            </button>
            <button
              disabled={isSaving}
              onClick={() => handleClose()}
              className="px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-white/[0.08] flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <X className="w-3.5 h-3.5 text-rose-400" /> Close
            </button>
          </div>
          <button
            onClick={() => {
              const maxSets = match.bestOfSets || 1;
              if (match.setsHistory.length >= maxSets) {
                setConfirmAction({
                  title: "Resume Match?",
                  message: `This is a Best-of-${maxSets} match and ${match.setsHistory.length} set${match.setsHistory.length > 1 ? "s have" : " has"} been played. Are you sure you want to add another set?`,
                  confirmLabel: "Resume Anyway",
                  confirmColor: "bg-amber-600 hover:bg-amber-500",
                  onConfirm: () => updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined }),
                });
              } else {
                updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined });
              }
            }}
            className="mt-3 text-[9px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest underline underline-offset-2 block mx-auto cursor-pointer transition"
          >
            Wait, add a set / resume match
          </button>
        </div>
      ) : (
        <>
          {/* ── Break Timer Banner ── */}
          {breakSecondsLeft !== null && (
            <div className="w-full bg-amber-500/[0.07] border border-amber-500/20 rounded-2xl mb-3 overflow-hidden backdrop-blur-sm">
              <div className="h-0.5 bg-slate-800">
                <div
                  className={`h-full transition-all duration-1000 ${breakSecondsLeft < 0 ? 'bg-rose-500' : 'bg-amber-400'}`}
                  style={{ width: breakTotalSeconds ? `${Math.min(100, ((breakTotalSeconds - breakSecondsLeft) / breakTotalSeconds) * 100)}%` : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-amber-300 font-black text-[10px] sm:text-xs uppercase tracking-widest">{breakLabel || "Break"}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Elapsed: {(() => {
                        const elapsed = (breakTotalSeconds ?? breakSecondsLeft) - breakSecondsLeft;
                        return `${Math.floor(Math.abs(elapsed) / 60).toString().padStart(2, "0")}:${(Math.abs(elapsed) % 60).toString().padStart(2, "0")}`;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-black text-xl sm:text-2xl tabular-nums tracking-tighter ${breakSecondsLeft < 0 ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]'}`}>
                    {breakSecondsLeft < 0 ? "-" : ""}{Math.floor(Math.abs(breakSecondsLeft) / 60).toString().padStart(2, "0")}:{(Math.abs(breakSecondsLeft) % 60).toString().padStart(2, "0")}
                  </span>
                  <button onClick={endBreak} className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-bold text-[10px] rounded-xl border border-white/[0.08] transition backdrop-blur-sm shrink-0">
                    End
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Score Cards ── */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6 [--card-gap:0.5rem] sm:[--card-gap:1rem] md:[--card-gap:1.5rem]">
            {([1, 2] as const).map((team) => {
              const t = team === 1 ? match.t1 : match.t2;
              const isServing = match.serverTeam === team;
              const swapOffset =
                team === 1
                  ? "translateX(calc(100% + var(--card-gap)))"
                  : "translateX(calc(-100% - var(--card-gap)))";
              const teamVar = team === 1 ? "var(--team-1)" : "var(--team-2)";
              const teamGradient = isServing
                ? "bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--team)_22%,transparent),color-mix(in_srgb,var(--team)_6%,transparent))] border-[color-mix(in_srgb,var(--team)_60%,transparent)] shadow-[0_0_40px_color-mix(in_srgb,var(--team)_15%,transparent)]"
                : "bg-gradient-to-b from-slate-800/60 to-slate-900/40 border-slate-700/40";
              const scoreGlow = isServing
                ? "text-[var(--team)] drop-shadow-[0_0_20px_color-mix(in_srgb,var(--team)_40%,transparent)]"
                : "text-[var(--team)]";
              const servingColor = "text-[var(--team)]";
              const servingDotColor = "bg-[var(--team)] shadow-[0_0_8px_color-mix(in_srgb,var(--team)_60%,transparent)]";

              return (
                <div
                  key={team}
                  data-testid={`btn-add-point-t${team}`}
                  role="button"
                  tabIndex={isSyncing ? -1 : 0}
                  aria-disabled={isSyncing}
                  aria-label={`Add point for ${t.teamName || t.p1Name || `team ${team}`}`}
                  onClick={() => !isSyncing && addPoint(team)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || isSyncing) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      addPoint(team);
                    }
                  }}
                  style={{ transform: match.endsSwapped ? swapOffset : "translateX(0)", ["--team" as any]: teamVar }}
                  className={`relative cursor-pointer select-none rounded-[1.25rem] sm:rounded-3xl border-2 p-2 sm:p-4 md:p-6 flex flex-col items-center backdrop-blur-sm transition-[transform,background-color,border-color,box-shadow] duration-500 ease-in-out active:duration-75 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 ${teamGradient}`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); deductPoint(team); }}
                    className="absolute top-2 left-2 w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-black/30 hover:bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 z-10 transition"
                    aria-label="Deduct point"
                  >
                    <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                  </button>

                  <div className="text-center px-5 w-full min-w-0">
                    <h3 className="text-[10px] sm:text-sm md:text-lg font-black truncate leading-tight w-full text-white/90">
                      {t.p1Name}{cardBadge(team === 1 ? "t1p1" : "t2p1")}
                    </h3>
                    {t.p2Name && (
                      <h3 className="text-[10px] sm:text-sm md:text-lg font-black truncate leading-tight w-full text-white/70">
                        {t.p2Name}{cardBadge(team === 1 ? "t1p2" : "t2p2")}
                      </h3>
                    )}
                  </div>

                  <div className="h-4 md:h-5 mt-0.5 flex items-center justify-center">
                    {isServing ? (
                      <span className={`inline-flex items-center gap-1 ${servingColor} text-[8px] sm:text-[10px] md:text-xs font-black uppercase tracking-widest`}>
                        <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${servingDotColor} animate-pulse`} /> Serving
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 text-[8px] sm:text-[10px] md:text-xs font-bold uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-slate-600" /> Receiving
                      </span>
                    )}
                  </div>

                  <div data-testid={`t${team}-score`} className={`text-[4.5rem] sm:text-[7rem] md:text-[9rem] leading-none font-black tracking-tighter tabular-nums transition-all duration-300 ${scoreGlow}`}>
                    {t.score}
                  </div>

                  <div className="mt-1.5 sm:mt-2 flex justify-center gap-1.5">
                    {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${i < t.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] scale-110" : "bg-slate-700/60 border border-slate-600/50"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Score Announcement ── */}
          <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4 px-4 py-2 sm:py-2.5 mx-auto w-fit rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity duration-300 ${match.serverTeam === 1 ? "bg-[var(--team-1)] animate-pulse" : "bg-transparent"}`} />
            <span className="text-[var(--team-1)] text-[9px] sm:text-[11px] font-black uppercase tracking-wider truncate max-w-[80px] sm:max-w-none">
              {match.t1.p2Name ? `${match.t1.p1Name} / ${match.t1.p2Name}` : match.t1.p1Name}
            </span>
            <span className="text-[var(--team-1)] text-base sm:text-lg font-black tabular-nums">{match.t1.score}</span>
            <span className="text-slate-600 text-xs font-black">—</span>
            <span className="text-[var(--team-2)] text-base sm:text-lg font-black tabular-nums">{match.t2.score}</span>
            <span className="text-[var(--team-2)] text-[9px] sm:text-[11px] font-black uppercase tracking-wider truncate max-w-[80px] sm:max-w-none">
              {match.t2.p2Name ? `${match.t2.p1Name} / ${match.t2.p2Name}` : match.t2.p1Name}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity duration-300 ${match.serverTeam === 2 ? "bg-[var(--team-2)] animate-pulse" : "bg-transparent"}`} />
            {match.setsHistory.length > 0 && <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 ml-1">({match.setsHistory.join(", ")})</span>}
          </div>

          {/* ── BWF 25s Rally Timer ── */}
          {rallyTimer !== null && (
            <div className="flex justify-center mt-1.5">
              <span className={`text-xs font-mono font-black tabular-nums ${
                rallyTimer > 5 ? "text-slate-500" : rallyTimer > 0 ? "text-amber-400" : "text-rose-400 animate-pulse"
              }`}>
                {rallyTimer}s
              </span>
            </div>
          )}

          {/* ── Court Visual ── */}
          <div className="flex justify-center mt-2 sm:mt-3">
            <CourtVisual
              serverTeam={match.serverTeam}
              serverPlayerIndex={match.serverPlayerIndex}
              receiverPlayerIndex={match.receiverPlayerIndex}
              t1RightCourt={match.t1RightCourt}
              t2RightCourt={match.t2RightCourt}
              t1Name={match.t1.p1Name}
              t2Name={match.t2.p1Name}
              t1P2Name={match.t1.p2Name}
              t2P2Name={match.t2.p2Name}
              t1Score={match.t1.score}
              t2Score={match.t2.score}
              isDoubles={sideIsDoubles(match.t1) || sideIsDoubles(match.t2)}
              endsSwapped={match.endsSwapped}
            />
          </div>

          {/* ── 3-Tab Controls Row ── */}
          <div className="mt-3 sm:mt-4">
            <div className="flex gap-1.5 w-full">
              <button
                onClick={() => { setShowSettings(!showSettings); setShowBreak(false); setShowMore(false); }}
                className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 rounded-xl border backdrop-blur-sm transition-all overflow-hidden ${
                  showSettings ? "bg-white/[0.08] border-white/[0.15] shadow-inner" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 w-full">
                  <Settings className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${showSettings ? "text-slate-300" : "text-slate-400"}`} />
                  <span className={`text-[8.5px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest truncate ${showSettings ? "text-white" : "text-slate-400"}`}>Settings</span>
                </div>
              </button>

              <button
                onClick={() => { setShowBreak(!showBreak); setShowSettings(false); setShowMore(false); }}
                className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 rounded-xl border backdrop-blur-sm transition-all overflow-hidden ${
                  breakSecondsLeft !== null
                    ? showBreak ? "bg-amber-500/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "bg-amber-500/[0.08] border-amber-500/30 hover:bg-amber-500/15"
                    : showBreak ? "bg-white/[0.08] border-white/[0.15] shadow-inner" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 w-full">
                  <Timer className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${breakSecondsLeft !== null ? "text-amber-400 animate-pulse" : showBreak ? "text-slate-300" : "text-slate-400"}`} />
                  <span className={`text-[8.5px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest truncate ${breakSecondsLeft !== null ? "text-amber-300" : showBreak ? "text-white" : "text-slate-400"}`}>
                    Break {breakSecondsLeft !== null && <span className="text-[8px] sm:text-[9px] text-amber-400/80 tracking-normal normal-case ml-0.5">({breakSecondsLeft < 0 ? "-" : ""}{Math.floor(Math.abs(breakSecondsLeft) / 60).toString().padStart(2, "0")}:{(Math.abs(breakSecondsLeft) % 60).toString().padStart(2, "0")})</span>}
                  </span>
                </div>
              </button>

              <button
                onClick={() => { setShowMore(!showMore); setShowSettings(false); setShowBreak(false); }}
                className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 rounded-xl border backdrop-blur-sm transition-all overflow-hidden ${
                  showMore ? "bg-white/[0.08] border-white/[0.15] shadow-inner" : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 w-full">
                  <MoreHorizontal className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${showMore ? "text-slate-300" : "text-slate-400"}`} />
                  <span className={`text-[8.5px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest truncate ${showMore ? "text-white" : "text-slate-400"}`}>More</span>
                </div>
              </button>
            </div>

            <div className={`transition-all duration-300 overflow-hidden ${showSettings || showBreak || showMore ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
              <div className={`rounded-2xl border bg-white/[0.02] backdrop-blur-sm p-2 pt-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 ${showBreak && breakSecondsLeft !== null ? "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : "border-white/[0.06]"}`}>
                {showSettings && (
                  <>
                    <button onClick={() => updateMatch({ endsSwapped: !match.endsSwapped })} className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Swap Ends
                    </button>
                    <button onClick={() => updateMatch({ serverTeam: match.serverTeam === 1 ? 2 : 1, serverPlayerIndex: 0, receiverPlayerIndex: 0 })} className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                      <Shuffle className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Switch Server
                    </button>
                    {servingTeamIsDoubles && (
                      <button
                        onClick={() => {
                          const flip = (v: 0 | 1 | undefined) => ((v ?? 0) === 0 ? 1 : 0) as 0 | 1;
                          updateMatch({
                            serverPlayerIndex: match.serverPlayerIndex === 0 ? 1 : 0,
                            ...(match.serverTeam === 1
                              ? { t1RightCourt: flip(match.t1RightCourt) }
                              : { t2RightCourt: flip(match.t2RightCourt) }),
                          });
                        }}
                        className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition"
                      >
                        <Repeat className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Swap Server Player
                      </button>
                    )}
                    {receivingTeamIsDoubles && (
                      <button
                        onClick={() => {
                          const flip = (v: 0 | 1 | undefined) => ((v ?? 0) === 0 ? 1 : 0) as 0 | 1;
                          const nextReceiver = (match.receiverPlayerIndex === 0 ? 1 : 0) as 0 | 1;
                          updateMatch({
                            receiverPlayerIndex: nextReceiver,
                            ...(match.serverTeam === 1
                              ? { t2RightCourt: flip(match.t2RightCourt) }
                              : { t1RightCourt: flip(match.t1RightCourt) }),
                          });
                        }}
                        className="py-2.5 px-2 bg-white/[0.04] hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-amber-500/30 transition"
                      >
                        <Repeat className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Swap Receiver
                      </button>
                    )}
                    <button onClick={() => setIsDirectScoreOpen(true)} className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                      <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Direct Score
                    </button>
                    <button onClick={() => setIsEditSetupOpen(true)} className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                      <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Edit Setup
                    </button>
                    <button onClick={() => { window.location.href = `${import.meta.env.BASE_URL}tv/camera/${tournamentMatch?.id || match.id || ""}`; }} className="py-2.5 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-red-500/20 hover:border-red-500/40 transition cursor-pointer">
                      <Camera className="w-3.5 h-3.5 shrink-0" /> Broadcast
                    </button>
                  </>
                )}

                {showBreak && (
                  <>
                    {[["30s", 30, "Short Break"], ["1 min", 60, "1-min Interval"], ["90s", 90, "Set 1→2 Interval"], ["2 min", 120, "Set 2→3 Interval"]].map(([label, secs, lbl]) => (
                      <button
                        key={label as string}
                        onClick={() => startBreak(secs as number, lbl as string)}
                        className={`py-2.5 font-bold text-[10px] sm:text-xs rounded-xl transition-all flex justify-center items-center gap-1.5 ${
                          breakTotalSeconds === secs
                            ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                            : "bg-white/[0.03] hover:bg-amber-500/10 border border-white/[0.06] hover:border-amber-500/30 text-slate-400 hover:text-amber-300"
                        }`}
                      >
                        <Timer className="w-3.5 h-3.5 shrink-0" />{label as string}
                      </button>
                    ))}
                  </>
                )}

                {showMore && (
                  <>
                    <button
                      onClick={forceEndSet}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-white/[0.06] hover:border-[color-mix(in_srgb,var(--success)_30%,transparent)] text-slate-300 hover:text-[var(--success)] font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" /> Add Set
                    </button>
                    <button
                      onClick={callLet}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 text-slate-300 hover:text-blue-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      ↩ Let
                    </button>
                    <button
                      onClick={() => callServiceFault(match.serverTeam)}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-orange-500/10 border border-white/[0.06] hover:border-orange-500/30 text-slate-300 hover:text-orange-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      ✗ Fault
                    </button>
                    <button
                      onClick={() => { setShowCardPanel(true); setCardTarget(null); }}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-yellow-500/10 border border-white/[0.06] hover:border-yellow-500/30 text-slate-300 hover:text-yellow-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      <Flag className="w-3.5 h-3.5 shrink-0" /> Cards
                    </button>
                    <button
                      onClick={() => setShowRetireModal(true)}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/30 text-slate-300 hover:text-rose-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Retire
                    </button>
                    <button
                      onClick={() => setShowLog(!showLog)}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition"
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" /> Log ({match.pointLog.length})
                    </button>
                    <div className="col-span-2 sm:col-span-3 md:col-span-4 border-t border-white/[0.06] my-1" />
                    <button
                      onClick={() => setConfirmAction({
                        title: "Cancel Match",
                        message: "Are you sure you want to exit without saving? Any unsaved progress will be lost.",
                        confirmLabel: "Cancel Match",
                        confirmColor: "bg-rose-600 hover:bg-rose-500",
                        onConfirm: () => handleClose({ endBroadcast: true }),
                      })}
                      className="py-2.5 px-2 bg-white/[0.03] hover:bg-rose-500/10 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.05] hover:border-rose-500/20 transition"
                    >
                      <X className="w-3.5 h-3.5 shrink-0" /> Cancel
                    </button>
                    <button
                      onClick={() => setConfirmAction({
                        title: "Abort Match",
                        message: "Are you sure you want to permanently abort this match and delete its records?",
                        confirmLabel: "Abort Match",
                        confirmColor: "bg-rose-600 hover:bg-rose-500",
                        onConfirm: async () => {
                          try {
                            const lm = await umpireService.fetchLiveMatchesRegistry();
                            if (lm[match.id]) {
                              delete lm[match.id];
                              await umpireService.saveLiveMatchesRegistry(lm);
                            }
                            if (!match.isFriendly) {
                              const tId = tournamentMatch?.id || match.dbId || match.id;
                              if (tId) {
                                await umpireService.resetMatchToScheduled(tId, "Umpire aborted the live scoring broadcast before completion");
                              }
                            }
                          } catch (e) {
                            console.error("Failed to abort broadcast", e);
                          }
                          handleClose({ endBroadcast: true });
                        },
                      })}
                      className="py-2.5 px-2 bg-white/[0.03] hover:bg-rose-500/10 text-rose-500 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.05] hover:border-rose-500/20 transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Abort
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Sets History & Editing ── */}
      {match.setsHistory.length > 0 && (
        <div className={`${match.status === "finished" ? "mt-4" : "mt-8"} bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden overflow-x-auto`}>
          <table className="w-full text-sm text-left table-fixed">
            <thead className="bg-slate-800/80 text-[10px] sm:text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 sm:px-4 py-3 border-b border-slate-700 font-black w-[40px] sm:w-[60px]"></th>
                <th className="px-2 sm:px-4 py-3 border-b border-slate-700 text-center font-black text-primary w-[30%]">
                  <div className="flex flex-col items-center justify-center gap-0.5 break-words">
                    <span className="line-clamp-2 leading-tight">{match.t1.p1Name}</span>
                    {match.t1.p2Name && <span className="line-clamp-2 leading-tight">& {match.t1.p2Name}</span>}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-3 border-b border-slate-700 text-center font-black text-[var(--info)] w-[30%]">
                  <div className="flex flex-col items-center justify-center gap-0.5 break-words">
                    <span className="line-clamp-2 leading-tight">{match.t2.p1Name}</span>
                    {match.t2.p2Name && <span className="line-clamp-2 leading-tight">& {match.t2.p2Name}</span>}
                  </div>
                </th>
                <th className="px-2 sm:px-4 py-3 border-b border-slate-700 font-black text-center text-amber-400 w-[20%]">Winner</th>
                <th className="px-2 sm:px-4 py-3 border-b border-slate-700 font-black text-center w-[40px] sm:w-[60px]"></th>
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
                    <td className="px-2 sm:px-4 py-3 font-bold text-muted-foreground whitespace-nowrap text-xs sm:text-sm">Set {i + 1}</td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <input
                        type="text"
                        maxLength={2}
                        value={s1}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                          handleEditSet(i, capped, s2);
                        }}
                        className="w-10 sm:w-16 bg-slate-900 border border-slate-600 rounded-lg px-1 sm:px-2 py-1 text-center font-bold text-primary outline-none focus:border-primary transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <input
                        type="text"
                        maxLength={2}
                        value={s2}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          const capped = raw && parseInt(raw) > match.goldenPoint ? match.goldenPoint.toString() : raw;
                          handleEditSet(i, s1, capped);
                        }}
                        className="w-10 sm:w-16 bg-slate-900 border border-slate-600 rounded-lg px-1 sm:px-2 py-1 text-center font-bold text-[var(--info)] outline-none focus:border-[var(--info)] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-3 font-semibold text-[10px] sm:text-xs text-muted-foreground text-center">
                      <div className="line-clamp-2 break-words leading-tight">{winnerStr}</div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => reopenSet(i)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-xs" title="Reopen Set in Score Panel">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {match.setsHistory.length > 1 && (
                          <button onClick={() => deleteSet(i)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-rose-900/50 text-slate-500 hover:text-rose-400 rounded-lg transition-colors border border-slate-700 hover:border-rose-700 shadow-xs" title="Delete Set">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!!match.winner && (
                <tr className="bg-primary/20">
                  <td colSpan={3} className="px-2 sm:px-4 py-4 font-black text-amber-500 text-right sm:pr-6 uppercase tracking-widest text-[10px] sm:text-xs">
                    Match Winner
                  </td>
                  <td colSpan={2} className="px-2 sm:px-4 py-4 font-black text-amber-400 text-center">
                    <div className="line-clamp-2 break-words leading-tight text-[11px] sm:text-sm">
                      {match.winner === 1
                        ? match.t1.p1Name + (match.t1.p2Name ? ` & ${match.t1.p2Name}` : "")
                        : match.winner === 2
                          ? match.t2.p1Name + (match.t2.p2Name ? ` & ${match.t2.p2Name}` : "")
                          : "-"}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Point-by-Point Log ── */}
      {match.status === "playing" && showLog && (
        <div className="mt-4 bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
          <div className="px-4 py-2.5 border-b border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Match Log</span>
              <div className="flex items-center gap-3 mt-1 text-[10px]">
                <span className="text-primary font-bold">T1: {match.t1.p1Name}{match.t1.p2Name && ` / ${match.t1.p2Name}`}</span>
                <span className="text-[var(--info)] font-bold">T2: {match.t2.p1Name}{match.t2.p2Name && ` / ${match.t2.p2Name}`}</span>
              </div>
            </div>
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
                      : entry.team === 2 ? "text-[var(--info)]"
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
                    <span className={`ml-1.5 text-[9px] ${entry.serverTeam === 1 ? "text-primary" : "text-[var(--info)]"}`}>
                      🏸T{entry.serverTeam}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Match Action Buttons (Bottom Dock) ── */}
      {match.status === "playing" && (
        <div className="mt-5 mb-1 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={async () => {
                const t1Name = match.t1.p2Name ? `${match.t1.p1Name} & ${match.t1.p2Name}` : match.t1.p1Name;
                const t2Name = match.t2.p2Name ? `${match.t2.p1Name} & ${match.t2.p2Name}` : match.t2.p1Name;
                const setsHistory = match.setsHistory.length > 0 ? match.setsHistory.join(", ") : "Set 1";
                const matchTitle = match.category ? `🏸 ${match.category} Live Score` : "🏸 Live Match Score";
                const scoreMessage = `${t1Name} vs ${t2Name} | Sets: ${setsHistory} | Game: ${match.t1.score}-${match.t2.score}`;
                try {
                  await umpireService.pushMatchAlert({
                    court: tournamentMatch?.court_number ? `Court ${tournamentMatch.court_number}` : "Main Court",
                    message: scoreMessage,
                    tournamentId: tournamentMatch?.tournament_id,
                  });
                } catch (e) {
                  console.warn("Match alert warning", e);
                }
                let pushResp: any = null;
                let pushErr: any = null;
                try {
                  pushResp = await umpireService.invokePushLiveScore({
                    message: scoreMessage,
                    title: matchTitle,
                    match_id: match.id,
                  });
                } catch (err: any) {
                  pushErr = err;
                }
                if (pushErr) {
                  toast.warning("Live banner shown, but device push failed: " + pushErr.message);
                } else if (pushResp?.total === 0) {
                  toast.success("Score pushed! (No devices registered for push notifications)");
                } else {
                  toast.success(`Score pushed to all users! (${pushResp?.sent ?? 0} devices notified)`);
                }
              }}
              className="px-2 py-3 bg-[color-mix(in_srgb,var(--info)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--info)_20%,transparent)] text-[var(--info)] font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-[color-mix(in_srgb,var(--info)_15%,transparent)] hover:border-[color-mix(in_srgb,var(--info)_30%,transparent)] transition active:scale-95"
            >
              <Tv2 className="w-3.5 h-3.5" /> Push Score
            </button>
            <button
              onClick={() => setConfirmAction({
                title: "Finish Match",
                message: "Are you sure you want to forcefully finish this match?",
                confirmLabel: "Finish Match",
                confirmColor: "bg-primary hover:bg-primary",
                onConfirm: () => updateMatch({ status: 'finished', winner: match.t1.games >= match.t2.games ? 1 : 2 }),
              })}
              className="px-2 py-3 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-[var(--success)] font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-[color-mix(in_srgb,var(--success)_20%,transparent)] hover:border-[color-mix(in_srgb,var(--success)_40%,transparent)] transition active:scale-95 shadow-[0_0_16px_rgba(16,185,129,0.08)]"
            >
              <Save className="w-3.5 h-3.5" /> Finish
            </button>
          </div>
        </div>
      )}

      {/* ── Takeover Request Modal ── */}
      {match.takeoverRequest?.status === "pending" && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border border-primary/50 rounded-[2rem] p-6 shadow-2xl shadow-primary/20 space-y-6 w-full max-w-sm animate-in zoom-in-95 fade-in duration-200">
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-foreground">Handover Request</h3>
              <p className="text-sm text-slate-300">
                <span className="font-bold text-primary">{match.takeoverRequest.requesterName}</span> wants to take over umpiring this match.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  updateMatch({ takeoverRequest: { ...match.takeoverRequest!, status: "rejected" } });
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-on-accent font-bold rounded-xl transition"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  updateMatch({ takeoverRequest: { ...match.takeoverRequest!, status: "approved" } });
                  toast.success("Handover approved. You can now close this match.");
                }}
                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition shadow-lg"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
