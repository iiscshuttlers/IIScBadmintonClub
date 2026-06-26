import { playTimerEndEffect } from "@/lib/umpire/umpireEffects";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUmpireStore } from "@/store/umpireStore";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { MatchService } from "@/services/matchService";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { ScoringLogic, type MatchFormat } from "@/lib/umpire/scoringLogic";
import type { PlayerSlim as Player } from "@/types";
import { MatchEditState, BwfMatchState, PointLogEntry, CardType, CardTarget } from "@/types/umpire";
import { usePlayers, usePlayerBuddies } from "@/hooks/usePlayers";
import { computeAddPoint, computeDeductPoint, computeForceEndSet, computeEditSet } from "@/lib/umpire/umpireMutations";
import { useUmpireHelpers } from "@/hooks/useUmpireHelpers";

export interface UmpireStateProps {
  userId: string;
  userEmail: string;
  userName: string;
  isTournamentUmpire?: boolean;
  friendlyOnly?: boolean;
  initialMatchState?: BwfMatchState | MatchEditState | null;
  onClose: () => void;
}

export function useUmpireState({
  userId,
  userEmail,
  userName,
  isTournamentUmpire,
  friendlyOnly,
  initialMatchState,
  onClose
}: UmpireStateProps) {
  const isAdmin = isAdminEmail(userEmail);
  const [players, setPlayers] = useState<Player[]>([]);
  // Use Zustand store instead
  const {
    match: storeMatch, setMatch, updateMatch: storeUpdateMatch,
    showLog, setShowLog,
    showChangeEnds, setShowChangeEnds,
    changeEndsReason, setChangeEndsReason,
    pendingBreakAfterEnds, setPendingBreakAfterEnds,
    showCardPanel, setShowCardPanel,
    cardTarget, setCardTarget,
    showRetireModal, setShowRetireModal,
    isEditSetupOpen, setIsEditSetupOpen,
    showToolsMenu, setShowToolsMenu,
    isDirectScoreOpen, setIsDirectScoreOpen,
    showFullTimer, setShowFullTimer,
    directSetsText, setDirectSetsText,
    directWinner, setDirectWinner,
    breakSecondsLeft, setBreakSecondsLeft,
    breakLabel, setBreakLabel
  } = useUmpireStore();


  const match = storeMatch || (() => {
    
      if (initialMatchState && 'is_edit_mode' in initialMatchState && initialMatchState.is_edit_mode) {
        const editState = initialMatchState as MatchEditState;
        // Prefer structured sets_history stored in DB; fall back to parsing the
        // display string only for matches saved before this column existed.
        let setsHistory: string[];
        if (editState.sets_history && editState.sets_history.length > 0) {
          setsHistory = editState.sets_history;
        } else {
          const rawScore = editState.score || editState.match_score || "";
          const setsPartMatch = rawScore.match(/^([\d-]+(?:, [\d-]+)*)/);
          setsHistory = setsPartMatch ? setsPartMatch[1].split(", ") : [];
        }
  
        // Count actual set wins from setsHistory rather than hardcoding 2
        const t1GamesWon = setsHistory.filter(s => {
          const [a, b] = s.split("-").map(Number);
          return a > b;
        }).length;
        const t2GamesWon = setsHistory.filter(s => {
          const [a, b] = s.split("-").map(Number);
          return b > a;
        }).length;
  
        return {
          id: userId,
          dbId: editState.id,
          umpireName: userName,
          isFriendly: editState.is_friendly ?? true,
          matchNumber: editState.round ?? "",
          category: editState.category ?? "Singles",
          pointsToWin: 21,
          bestOfSets: 3,
          goldenPoint: 30,
          t1: { p1Id: editState.player1_id, p1Name: editState.player1?.full_name ?? "", p2Id: editState.team1_partner_id ?? undefined, p2Name: editState.partner1?.full_name ?? "", score: 0, games: t1GamesWon },
          t2: { p1Id: editState.player2_id, p1Name: editState.player2?.full_name ?? "", p2Id: editState.team2_partner_id ?? undefined, p2Name: editState.partner2?.full_name ?? "", score: 0, games: t2GamesWon },
          serverTeam: 1,
          serverPlayerIndex: 0,
          receiverPlayerIndex: 0,
          receiverP0AtTop: true,
          t1LastServedBy: 1,
          t2LastServedBy: 1,
          endsSwapped: false,
          pointLog: [],
          status: "playing",
          winner: undefined,
          setsHistory: setsHistory,
        } as BwfMatchState;
      }
      // Resume / take over a full live match (BwfMatchState saved in site_data).
      // Keep its own `id` (the persistence key) so updates write back to the same broadcast.
      if (initialMatchState && 'status' in initialMatchState && initialMatchState.status && 't1' in initialMatchState) {
        const liveState = initialMatchState as BwfMatchState;
        return {
          ...liveState,
          id: liveState.id || userId,
          umpireName: liveState.umpireName || userName,
        } as BwfMatchState;
      }
      return {
        id: userId,
        umpireName: userName,
        isFriendly: true,
        matchNumber: "",
        category: "Singles",
        pointsToWin: 21,
        bestOfSets: 3,
        goldenPoint: 30,
        t1: { p1Id: "", p1Name: "", score: 0, games: 0 },
        t2: { p1Id: "", p1Name: "", score: 0, games: 0 },
        serverTeam: 1,
        serverPlayerIndex: 0,
        receiverPlayerIndex: 0,
        receiverP0AtTop: true,
        t1LastServedBy: 1,
        t2LastServedBy: 1,
        endsSwapped: false,
        pointLog: [],
        status: "setup",
        setsHistory: [],
      };
    
  })();

  useEffect(() => {
    if (!storeMatch) {
      setMatch(match);
    }
  }, [storeMatch, setMatch, match]);

  
    // Discipline cards: per player slot, array of card types issued
    // cards now in Zustand
    const cards = useUmpireStore(s => s.cards);
    const setCards = useUmpireStore(s => s.setCards);
  
    // Overlay / modal flags
    // showLog now in Zustand
    // showChangeEnds now in Zustand
    // changeEndsReason now in Zustand
    // pendingBreakAfterEnds now in Zustand
  
    // showCardPanel now in Zustand
    // cardTarget now in Zustand
  
    // showRetireModal now in Zustand
    // isEditSetupOpen now in Zustand
    // showToolsMenu now in Zustand
  
    // isDirectScoreOpen now in Zustand
    // showFullTimer now in Zustand
    // directSetsText now in Zustand
    // directWinner now in Zustand
  
    // Buddy check for regular users: load own buddies list once
    const { data: myBuddiesData } = usePlayerBuddies(userId, { enabled: !isAdmin && !isTournamentUmpire });
    const myBuddies = myBuddiesData || [];
  
    const selectedPlayerIds = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id].filter(Boolean) as string[];
    const buddyCheckPassed = isAdmin || isTournamentUmpire
      || selectedPlayerIds.length === 0
      || selectedPlayerIds.some(id => myBuddies.includes(id));
  
    // Break timer
    // breakSecondsLeft now in Zustand
    // breakLabel now in Zustand
    const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
    const startBreak = (seconds: number, label = "") => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      setBreakLabel(label);
      setBreakSecondsLeft(seconds);
      setShowFullTimer(true);
      breakIntervalRef.current = setInterval(() => {
        const prev = useUmpireStore.getState().breakSecondsLeft;
        if (prev === null || prev <= 1) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
          playTimerEndEffect();
          setBreakSecondsLeft(null);
        } else {
          setBreakSecondsLeft(prev - 1);
        }
      }, 1000);
    };
  
    const endBreak = () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
      setBreakSecondsLeft(null);
      setBreakLabel("");
      setShowFullTimer(false);
    };
  
    useEffect(() => () => { if (breakIntervalRef.current) clearInterval(breakIntervalRef.current); }, []);
  
    const { data: playersData } = usePlayers();
    useEffect(() => {
      if (playersData) {
        setPlayers(playersData as unknown as Player[]);
      }
    }, [playersData]);
  
    const { getName, getGender, getInferredCategory, deduceCategory } = useUmpireHelpers(players, match);
    const updateMatch = async (updates: Partial<BwfMatchState>) => {
      const next = { ...match, ...updates };
      next.inferredCategory = getInferredCategory(next.category, next.t1, next.t2);
      setMatch(next);
      await MatchService.upsertLiveMatch(userId, next).catch(err => { toast.error("Broadcast sync failed — check your connection"); });
      const error = false;
      
    };
  

  
    // ── Start Match ─────────────────────────────────────────────────────────────
  
    const startMatch = async () => {
      if (!match.t1.p1Id || !match.t2.p1Id) {
        toast.error("Please fill in Player 1 for both teams");
        return;
      }
      if (!buddyCheckPassed) {
        toast.error("You must be a buddy of at least one player.");
        return;
      }
      const cat = deduceCategory();
      if (cat === "Hybrid") {
        toast.error("Invalid format: Singles vs Doubles matches are not allowed.");
        return;
      }
      // Compute fixed initial receiver position from setup choice.
      // Score 0 (even), server on left when serverTeam=1 (endsSwapped=false at start).
      // Server at bottom-left (even+left) → diagonal at top-right → if receiverPlayerIndex=0, P0 at top.
      // For serverTeam=2: server on right, even → server at top-right → diagonal at bottom-left.
      const initServerOnLeft = match.serverTeam === 1;
      const initIsEven = true; // score always 0 at start
      const initDiagonalAtTop = initServerOnLeft === initIsEven; // true if serverTeam=1
      const initReceiverP0AtTop = (initDiagonalAtTop === (match.receiverPlayerIndex === 0));
      await updateMatch({
        status: "playing",
        category: cat,
        receiverP0AtTop: initReceiverP0AtTop,
        t1: { ...match.t1, p1Name: getName(match.t1.p1Id), p2Name: match.t1.p2Id ? getName(match.t1.p2Id) : undefined },
        t2: { ...match.t2, p1Name: getName(match.t2.p1Id), p2Name: match.t2.p2Id ? getName(match.t2.p2Id) : undefined },
      });
      toast.success("Match Broadcast Started!");
    };
  
    // ── Add Point ───────────────────────────────────────────────────────────────
  
    const handleEditSet = (index: number, newT1Str: string, newT2Str: string) => {
      const updates = computeEditSet(match, index, newT1Str, newT2Str);
      updateMatch(updates);
    };
  
    const forceEndSet = () => {
      const updates = computeForceEndSet(match);
      if (updates) {
        if (match.t1.score === match.t2.score) {
          toast.error("Scores are tied! Cannot end set.");
          return;
        }
        updateMatch(updates);
        toast.success("Set ended!");
      }
    };
  
    const addPoint = (team: 1 | 2, note?: string) => {
      const updates = computeAddPoint(match, team, note);
      if (!updates) return;
      
      const { _changeEnds, _reason, _break, ...stateUpdates } = updates as any;
      updateMatch(stateUpdates);

      if (_changeEnds) {
        setPendingBreakAfterEnds(_break || null);
        setChangeEndsReason(_reason || "Change Ends");
        setShowChangeEnds(true);
      }
    };
  
    const deductPoint = (team: 1 | 2) => {
      const updates = computeDeductPoint(match, team);
      if (updates) updateMatch(updates);
    };
  
    // ── Dismiss change ends overlay ─────────────────────────────────────────────
    const confirmChangeEnds = () => {
      setShowChangeEnds(false);
      if (pendingBreakAfterEnds !== null) {
        startBreak(pendingBreakAfterEnds, changeEndsReason);
        setPendingBreakAfterEnds(null);
      }
    };
  
    // ── Let call ───────────────────────────────────────────────────────────────
    const callLet = () => {
      const currentGame = match.t1.games + match.t2.games + 1;
      const newLog: PointLogEntry = {
        gameNum: currentGame,
        team: "let",
        t1Score: match.t1.score,
        t2Score: match.t2.score,
        serverTeam: match.serverTeam,
        note: "Let — Replay",
        ts: Date.now(),
      };
      updateMatch({ pointLog: [...match.pointLog, newLog] });
      toast.info("Let called — rally replayed");
    };
  
    // ── Service fault ──────────────────────────────────────────────────────────
    const callServiceFault = (team: 1 | 2) => {
      // Point goes to opponent; note is carried into the log entry via addPoint
      const opponentName = team === 1 ? match.t2.p1Name : match.t1.p1Name;
      addPoint(team === 1 ? 2 : 1, `Service fault — T${team}`);
      toast.warning(`Service fault — point to ${opponentName}'s side`);
    };
  
    // ── Discipline cards ───────────────────────────────────────────────────────
    const issueCard = (target: CardTarget, cardType: CardType) => {
      const newCards = { ...cards, [target]: [...cards[target], cardType] };
      setCards(newCards);
      const playerName = target === "t1p1" ? match.t1.p1Name
        : target === "t1p2" ? (match.t1.p2Name || "T1 P2")
        : target === "t2p1" ? match.t2.p1Name
        : (match.t2.p2Name || "T2 P2");
  
      if (cardType === "yellow") {
        toast.warning(`⚠️ Yellow card — Warning to ${playerName}`);
      } else if (cardType === "red") {
        toast.error(`🟥 Red card — Point awarded to opponent of ${playerName}`);
        // Red card: point to opponent team
        const opponentTeam = target.startsWith("t1") ? 2 : 1;
        addPoint(opponentTeam);
      } else if (cardType === "black") {
        toast.error(`⬛ Black card — ${playerName} DISQUALIFIED`);
        // Match awarded to opponent
        const opponentTeam = target.startsWith("t1") ? 2 : 1;
        updateMatch({ status: "finished", winner: opponentTeam });
      }
      setShowCardPanel(false);
      setCardTarget(null);
    };
  
    // ── Retirement ─────────────────────────────────────────────────────────────
    const retireTeam = (team: 1 | 2) => {
      const winner = team === 1 ? 2 : 1;
      const loserName = team === 1
        ? match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : "")
        : match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : "");
      updateMatch({ status: "finished", winner, retiredTeam: team });
      toast.error(`${loserName} has retired from the match`);
      setShowRetireModal(false);
    };
  
    // ── Save match ─────────────────────────────────────────────────────────────
    const saveMatchToProfile = async () => {
      if (match.status !== "finished") return;
      const realIds = new Set(players.map(p => p.id));
      const toRealId = (id?: string) => (id && realIds.has(id) ? id : "");
      const hasAnyRealPlayer = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id]
        .some(id => id && realIds.has(id));
      if (!hasAnyRealPlayer) {
        toast.info("Match ended. Cannot log — all players are guests.");
        handleClose();
        return;
      }
      const t1IsWinner = match.winner === 1;
      const winnerTeam = t1IsWinner ? match.t1 : match.t2;
      const winnerId = toRealId(winnerTeam.p1Id) || toRealId(winnerTeam.p2Id);
      let finalScoreStr = match.retiredTeam
        ? match.setsHistory.join(", ") + ` (T${match.retiredTeam} Retired)`
        : match.setsHistory.join(", ");
      if (match.category !== "Singles") {
        finalScoreStr += ` [${match.t1.p1Name}+${match.t1.p2Name ?? ""} vs ${match.t2.p1Name}+${match.t2.p2Name ?? ""}]`;
      }
      try {
        const matchStartTs = match.pointLog.length > 0 ? match.pointLog[0].ts : Date.now();
        const matchEndTs = match.pointLog.length > 0 ? match.pointLog[match.pointLog.length - 1].ts : Date.now();
        const durationMinutes = Math.max(1, Math.round((matchEndTs - matchStartTs) / 60000));
        const roundLabel = `${match.matchNumber || (match.isFriendly ? "Friendly" : "Tournament")} • ${durationMinutes}m`;
  
        const umpirePlayerId = toRealId(userId);
        const payload = {
          umpire_id:          umpirePlayerId,
          player1_id:         toRealId(match.t1.p1Id),
          player2_id:         toRealId(match.t2.p1Id),
          team1_partner_id:   toRealId(match.t1.p2Id),
          team2_partner_id:   toRealId(match.t2.p2Id),
          winner_id:          winnerId,
          match_score:        finalScoreStr,
          match_category:     match.category,
          match_round:        roundLabel,
          is_friendly:        match.isFriendly,
          sets_history:       match.setsHistory,
        };
        
        let newMatchId = "";
        if (match.dbId) {
          // Update existing match
          await MatchService.updateMatch(match.dbId, winnerId, finalScoreStr, match.category, match.setsHistory);
          const updateError = null;
          if (updateError) throw updateError;
          newMatchId = match.dbId;
          toast.success("Match score updated successfully!");
        } else {
          const submitId = await MatchService.submitMatch(payload);
          const submitError = null;
          if (submitError) throw submitError;
          newMatchId = submitId;
          
          if (newMatchId && !match.isFriendly) {
            // Auto-confirm tournament matches only (admin-controlled)
            // Friendly matches require opponent confirmation
            await MatchService.confirmFriendlyMatch(newMatchId);
          }
        }
  
        const notifMsg = `🏆 ${match.isFriendly ? "Friendly" : "Tournament"} Match: ${match.t1.p1Name}${match.t1.p2Name ? ` & ${match.t1.p2Name}` : ""} vs ${match.t2.p1Name}${match.t2.p2Name ? ` & ${match.t2.p2Name}` : ""} — ${match.setsHistory.join(", ")}`;
        await supabase.from("site_data").upsert({ key: "match_alert", value: { message: notifMsg, time: Date.now() } });
        const hasGuests = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id]
          .some(id => id && !realIds.has(id));
        toast.success(hasGuests ? "Match saved! Guest players are not credited to any profile." : "Match saved to profiles!");
        handleClose();
      } catch (err: any) {
        toast.error("Failed to save: " + err.message);
      }
    };
  
    const handleClose = async () => {
      await MatchService.removeLiveMatch(userId);
      onClose();
    };
  
    // ── Helpers ────────────────────────────────────────────────────────────────
    const currentGameNum = match.t1.games + match.t2.games + 1;
    const serverScore   = match.serverTeam === 1 ? match.t1.score : match.t2.score;
    const receiverScore = match.serverTeam === 1 ? match.t2.score : match.t1.score;
    const serverName    = match.serverTeam === 1
      ? (match.t1.p2Name && match.serverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name)
      : (match.t2.p2Name && match.serverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name);
  
    const receiverName  = match.serverTeam === 1
      ? (match.t2.p2Name && match.receiverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name)
      : (match.t1.p2Name && match.receiverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name);
  
    const isDoubles = match ? (!!match.t1.p2Id || !!match.t2.p2Id) : false;
    const cardBadge = (target: CardTarget) => {
      const c = cards[target];
      if (!c.length) return null;
      const last = c[c.length - 1];
      return (
        <span className={`inline-block w-2.5 h-2.5 rounded-sm ml-1 ${last === "yellow" ? "bg-yellow-400" : last === "red" ? "bg-red-500" : "bg-slate-900 border border-white"}`} title={`${c.length} card(s)`} />
      );
    };
  

  return {
    players,
    match,
    cards,
    showLog,
    showChangeEnds,
    changeEndsReason,
    pendingBreakAfterEnds,
    showCardPanel,
    cardTarget,
    showRetireModal,
    isEditSetupOpen,
    showToolsMenu,
    isDirectScoreOpen,
    showFullTimer,
    directSetsText,
    directWinner,
    myBuddies,
    breakSecondsLeft,
    breakLabel,
    setPlayers,
    setMatch,
    setCards,
    setShowLog,
    setShowChangeEnds,
    setChangeEndsReason,
    setPendingBreakAfterEnds,
    setShowCardPanel,
    setCardTarget,
    setShowRetireModal,
    setIsEditSetupOpen,
    setShowToolsMenu,
    setIsDirectScoreOpen,
    setShowFullTimer,
    setDirectSetsText,
    setDirectWinner,
    setBreakSecondsLeft,
    setBreakLabel,
    updateMatch,
    startMatch,
    handleEditSet,
    addPoint,
    deductPoint,
    forceEndSet,
    confirmChangeEnds,
    callLet,
    callServiceFault,
    issueCard,
    retireTeam,
    saveMatchToProfile,
    handleClose,
    getName,
    getGender,
    deduceCategory,
    startBreak,
    endBreak,
    selectedPlayerIds,
    buddyCheckPassed,
    isDoubles,
    serverName,
    receiverName,
    currentGameNum,
    serverScore,
    receiverScore,
    cardBadge
  };
}
