import { playTimerEndEffect } from "@/lib/umpire/umpireEffects";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { TournamentMatchForUmpire } from "@/components/umpire/UmpireTournamentTab";
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
  tournamentMatch?: TournamentMatchForUmpire | null;
  onClose: () => void;
  onMatchSaved?: (matchId: string, matchSource: "friendly" | "tournament") => void;
}

export function useUmpireState({
  userId,
  userEmail,
  userName,
  isTournamentUmpire,
  friendlyOnly,
  initialMatchState,
  tournamentMatch,
  onClose,
  onMatchSaved
}: UmpireStateProps) {
  const isAdmin = isAdminEmail(userEmail);
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
    isSaving, setIsSaving,
    showFullTimer, setShowFullTimer,
    directSetsText, setDirectSetsText,
    directWinner, setDirectWinner,
    breakSecondsLeft, setBreakSecondsLeft,
    breakTotalSeconds, setBreakTotalSeconds,
    breakLabel, setBreakLabel
  } = useUmpireStore();

  const [hasSaved, setHasSaved] = useState(false);


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
        const t1Names = ((editState as any).team1_label || "").split(" & ");
        const t2Names = ((editState as any).team2_label || "").split(" & ");
        
        return {
          id: editState.id || crypto.randomUUID(),
          dbId: editState.id,
          umpireId: userId,
          umpireName: userName,
          isFriendly: editState.is_friendly ?? true,
          isTournamentMatch: editState.is_tournament_match,
          matchNumber: editState.round ?? "",
          category: editState.category ?? "Singles",
          pointsToWin: 21,
          bestOfSets: 3,
          goldenPoint: 30,
          t1: { 
            p1Id: editState.player1_id, 
            p1Name: editState.player1?.full_name || t1Names[0] || "Team 1", 
            p2Id: editState.team1_partner_id ?? undefined, 
            p2Name: editState.partner1?.full_name || t1Names[1] || "", 
            score: 0, 
            games: t1GamesWon 
          },
          t2: { 
            p1Id: editState.player2_id, 
            p1Name: editState.player2?.full_name || t2Names[0] || "Team 2", 
            p2Id: editState.team2_partner_id ?? undefined, 
            p2Name: editState.partner2?.full_name || t2Names[1] || "", 
            score: 0, 
            games: t2GamesWon 
          },
          serverTeam: 1,
          serverPlayerIndex: 0,
          receiverPlayerIndex: 0,
          receiverP0AtTop: true,
          t1LastServedBy: 1,
          t2LastServedBy: 1,
          endsSwapped: false,
          pointLog: [],
          status: "finished",
          winner: t1GamesWon > t2GamesWon ? 1 : t2GamesWon > t1GamesWon ? 2 : undefined,
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
          umpireId: liveState.umpireId || userId,
          umpireName: liveState.umpireName || userName,
        } as BwfMatchState;
      }
      // Tournament match pre-fill — skip player-search setup, go straight to server selection
      if (tournamentMatch) {
        const catMap: Record<string, string> = {
          MS: "Singles", WS: "Singles", MD: "Doubles", WD: "Doubles", XD: "Doubles",
        };
        const isT1Bye = (tournamentMatch.team1_label || "").toUpperCase().includes("BYE");
        const isT2Bye = (tournamentMatch.team2_label || "").toUpperCase().includes("BYE");
        const isByeMatch = isT1Bye || isT2Bye;
        const byeWinner: 1 | 2 = isT1Bye ? 2 : 1;

        return {
          id: tournamentMatch.id || crypto.randomUUID(),
          umpireId: userId,
          umpireName: userName,
          isFriendly: false,
          isTournamentMatch: true,
          matchNumber: tournamentMatch.match_code,
          category: catMap[tournamentMatch.category] ?? "Singles",
          pointsToWin: tournamentMatch.points_to_win,
          bestOfSets: tournamentMatch.best_of_sets,
          goldenPoint: tournamentMatch.golden_point,
          t1: {
            p1Id: tournamentMatch.player1_id ?? "",
            p1Name: tournamentMatch.team1_label ?? "Team 1",
            p2Id: tournamentMatch.player3_id ?? undefined,
            p2Name: "",
            score: 0,
            games: isByeMatch && byeWinner === 1 ? 2 : 0,
          },
          t2: {
            p1Id: tournamentMatch.player2_id ?? "",
            p1Name: tournamentMatch.team2_label ?? "Team 2",
            p2Id: tournamentMatch.player4_id ?? undefined,
            p2Name: "",
            score: 0,
            games: isByeMatch && byeWinner === 2 ? 2 : 0,
          },
          serverTeam: 1,
          serverPlayerIndex: 0,
          receiverPlayerIndex: 0,
          receiverP0AtTop: true,
          t1LastServedBy: 1,
          t2LastServedBy: 1,
          endsSwapped: false,
          pointLog: [],
          status: isByeMatch ? "finished" : "setup",
          winner: isByeMatch ? byeWinner : undefined,
          setsHistory: isByeMatch ? ["BYE"] : [],
        };
      }

      return {
        id: crypto.randomUUID(),
        umpireId: userId,
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

  useEffect(() => {
    if (!match.id || match.status === "finished") return;

    // Listen to site_data changes for live_matches
    const sub = supabase.channel(`umpire_engine_${match.id}_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" }, (payload) => {
        if (payload.new && (payload.new as any).value) {
          const newMatches = (payload.new as any).value;
          // The key in live_matches is now the match's id
          const remoteMatch = newMatches[match.id];
          if (remoteMatch) {
            // Check for new takeover request
            if (remoteMatch.takeoverRequest?.status === "pending" && useUmpireStore.getState().match?.takeoverRequest?.status !== "pending") {
              setMatch({ ...useUmpireStore.getState().match!, takeoverRequest: remoteMatch.takeoverRequest });
            }
          }
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(sub); };
  }, [match.id, match.status]);

  
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
      setBreakTotalSeconds(seconds);
      setShowFullTimer(false);
      breakIntervalRef.current = setInterval(() => {
        const prev = useUmpireStore.getState().breakSecondsLeft;
        if (prev === null) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
        } else {
          if (prev === 1) playTimerEndEffect();
          setBreakSecondsLeft(prev - 1);
        }
      }, 1000);
    };
  
    const endBreak = () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
      setBreakSecondsLeft(null);
      setBreakTotalSeconds(null);
      setBreakLabel("");
      setShowFullTimer(false);
    };
  
    useEffect(() => {
    if (breakSecondsLeft !== null && !breakIntervalRef.current) {
      breakIntervalRef.current = setInterval(() => {
        const prev = useUmpireStore.getState().breakSecondsLeft;
        if (prev === null) {
          clearInterval(breakIntervalRef.current!);
          breakIntervalRef.current = null;
        } else {
          if (prev === 1) playTimerEndEffect();
          setBreakSecondsLeft(prev - 1);
        }
      }, 1000);
    }
    return () => {
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
        breakIntervalRef.current = null;
      }
    };
  }, [breakSecondsLeft]);
  
    const { data: playersData } = usePlayers();
  const players = useMemo(() => (playersData as unknown as Player[]) || [], [playersData]);
  
    const { getName, getGender, getInferredCategory, deduceCategory } = useUmpireHelpers(players, match);
    const updateMatch = async (updates: Partial<BwfMatchState>) => {
      const next = { ...match, ...updates };
      next.inferredCategory = getInferredCategory(next.category, next.t1, next.t2);
      setMatch(next);
      await MatchService.upsertLiveMatch(next.id, next).catch(err => { toast.error("Broadcast sync failed — check your connection"); });
      
      if (tournamentMatch || next.isTournamentMatch) {
        const matchId = tournamentMatch?.id || next.id || next.dbId;
        if (matchId) {
          const currentScore = `${next.t1.score}-${next.t2.score}`;
          const setsArr = [...(next.setsHistory || [])];
          if (currentScore !== "0-0") setsArr.push(currentScore);

          try {
            const { error } = await supabase
              .from("tournament_matches")
              .update({
                score: currentScore,
                sets_history: setsArr,
                status: "in_progress"
              })
              .eq("id", matchId);
            if (error) throw error;
          } catch (e) {
            console.warn("Failed to sync tournament match score", e);
          }
        }
      }
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
      const cat = match.customCategory || deduceCategory();
      if (cat === "Hybrid") {
        toast.error("Invalid format: Singles vs Doubles matches are not allowed.");
        return;
      }
      const initServerOnLeft = match.serverTeam === 1;
      const initIsEven = true;
      const initDiagonalAtTop = initServerOnLeft === initIsEven;
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

    // Tournament variant — names already set, player IDs may be null (external players)
    const startTournamentMatch = async () => {
      const catMap: Record<string, string> = {
        MS: "Singles", WS: "Singles", MD: "Doubles", WD: "Doubles", XD: "Doubles",
      };
      const cat = tournamentMatch ? (catMap[tournamentMatch.category] ?? "Singles") : match.category;
      const initServerOnLeft = match.serverTeam === 1;
      const initDiagonalAtTop = initServerOnLeft; // score 0 is even
      const initReceiverP0AtTop = (initDiagonalAtTop === (match.receiverPlayerIndex === 0));
      await updateMatch({
        status: "playing",
        category: cat,
        receiverP0AtTop: initReceiverP0AtTop,
        // preserve pre-filled names — do NOT call getName() which needs player IDs
        t1: { ...match.t1 },
        t2: { ...match.t2 },
      });
      toast.success("Tournament match started!");
    };
  
    // ── Add Point ───────────────────────────────────────────────────────────────
  
    const handleEditSet = (index: number, newT1Str: string, newT2Str: string) => {
      const updates = computeEditSet(match, index, newT1Str, newT2Str);
      updateMatch(updates);
    };
  
    const undoSetFinish = () => {
      if (match.setsHistory.length === 0) return;
      const history = [...match.setsHistory];
      const lastSet = history.pop()!;
      const [s1, s2] = lastSet.split("-").map(Number);
      
      let newT1Games = match.t1.games;
      let newT2Games = match.t2.games;
      if (s1 > s2) newT1Games = Math.max(0, newT1Games - 1);
      else if (s2 > s1) newT2Games = Math.max(0, newT2Games - 1);

      updateMatch({
        status: "playing",
        winner: undefined,
        retiredTeam: undefined,
        setsHistory: history,
        t1: { ...match.t1, score: s1, games: newT1Games },
        t2: { ...match.t2, score: s2, games: newT2Games },
      });
      toast.success("Set finish undone!");
    };
    
    const deleteSet = (index: number) => {
      if (index < 0 || index >= match.setsHistory.length) return;
      const history = [...match.setsHistory];
      const removedSet = history.splice(index, 1)[0];
      const [s1, s2] = removedSet.split("-").map(Number);
      
      let newT1Games = match.t1.games;
      let newT2Games = match.t2.games;
      if (s1 > s2) newT1Games = Math.max(0, newT1Games - 1);
      else if (s2 > s1) newT2Games = Math.max(0, newT2Games - 1);

      updateMatch({
        setsHistory: history,
        t1: { ...match.t1, games: newT1Games },
        t2: { ...match.t2, games: newT2Games },
        status: "playing",
        winner: undefined,
        retiredTeam: undefined
      });
      toast.success(`Set ${index + 1} deleted!`);
    };

    const reopenSet = (index: number) => {
      if (index < 0 || index >= match.setsHistory.length) return;
      if (!confirm(`Are you sure you want to reopen Set ${index + 1}? All sets after this will be deleted.`)) return;
      
      const history = [...match.setsHistory];
      const setToReopen = history[index];
      const [s1, s2] = setToReopen.split("-").map(Number);
      
      const newHistory = history.slice(0, index);
      
      let newT1Games = 0;
      let newT2Games = 0;
      newHistory.forEach(setStr => {
        const [gs1, gs2] = setStr.split("-").map(Number);
        if (gs1 > gs2) newT1Games++;
        else if (gs2 > gs1) newT2Games++;
      });

      updateMatch({
        status: "playing",
        winner: undefined,
        retiredTeam: undefined,
        setsHistory: newHistory,
        t1: { ...match.t1, score: s1, games: newT1Games },
        t2: { ...match.t2, score: s2, games: newT2Games },
      });
      toast.success(`Set ${index + 1} reopened!`);
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

      // Check if we should auto-push score (half point or set end)
      // _changeEnds is true when a set finishes OR when reaching half point in third set.
      // But we also want to push at half point in ANY set.
      const newT1Score = stateUpdates.t1?.score ?? match.t1.score;
      const newT2Score = stateUpdates.t2?.score ?? match.t2.score;
      const t1Games = stateUpdates.t1?.games ?? match.t1.games;
      const t2Games = stateUpdates.t2?.games ?? match.t2.games;
      const oldT1Games = match.t1.games;
      const oldT2Games = match.t2.games;
      
      const safePointsToWin = match.pointsToWin || 30;
      const halfPoint = Math.ceil(safePointsToWin / 2);
      const isHalfPoint = (newT1Score === halfPoint && newT2Score < halfPoint) || (newT2Score === halfPoint && newT1Score < halfPoint);
      const isSetWon = t1Games > oldT1Games || t2Games > oldT2Games;

      // Ensure we don't push multiple times for the exact same half point
      // (This could happen if someone deducts a point and adds it again, but a little spam is okay for umpire, 
      // or we can just rely on the score exactly hitting the halfPoint)
      if ((isHalfPoint && (match.t1.score < halfPoint && match.t2.score < halfPoint)) || isSetWon) {
        const t1Name = match.t1.p2Name ? `${match.t1.p1Name} & ${match.t1.p2Name}` : match.t1.p1Name;
        const t2Name = match.t2.p2Name ? `${match.t2.p1Name} & ${match.t2.p2Name}` : match.t2.p1Name;
        const scoreStr = isSetWon 
          ? `Set won by ${t1Games > oldT1Games ? t1Name : t2Name}!`
          : `Half-time interval!`;
        const fullScore = `${t1Name} [${newT1Score} - ${newT2Score}] ${t2Name}`;
        
        // Push alert
        supabase.from("site_data").upsert({ 
          key: "match_alert", 
          value: { message: `🏆 ${match.category} Match: ${scoreStr} ${fullScore}`, time: Date.now() } 
        });
      }

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
      setIsSaving(true);
      try {
        if (match.status !== "finished") return;

        // Real match window, derived from the first/last scored point — used to
        // correlate Health Connect watch data instead of guessing a fixed window.
        const matchStartTs = match.pointLog.length > 0 ? match.pointLog[0].ts : Date.now();
        const matchEndTs = match.pointLog.length > 0 ? match.pointLog[match.pointLog.length - 1].ts : Date.now();

        // Tournament match path — submit to tournament_matches, no ELO impact
        if (tournamentMatch || match.isTournamentMatch || (!match.isFriendly && match.id)) {
          const matchId = tournamentMatch?.id || match.dbId || match.id;
          if (!matchId) return toast.error("Match ID missing");

          const winnerSide: 1 | 2 = match.winner === 1 ? 1 : 2;
          const scoreStr = match.setsHistory.join(", ");
          try {
            const { error } = await supabase.rpc("submit_tournament_match", {
              p_match_id: matchId,
              p_winner_side: winnerSide,
              p_score: scoreStr,
              p_sets: match.setsHistory,
              p_umpire_id: userId || null,
            });
            if (error) throw error;
            
            // Close UI immediately
            onMatchSaved?.(matchId, "tournament");
            toast.success("Tournament match result saved!");
            setHasSaved(true);

            // Background tasks: Notifications, edge functions, start/end times
            (async () => {
              // Best-effort: a failure here shouldn't block the match result itself from saving.
              await supabase.rpc("set_tournament_match_times", {
                p_match_id: matchId,
                p_started_at: new Date(matchStartTs).toISOString(),
                p_ended_at: new Date(matchEndTs).toISOString(),
              }).then(({ error: timesError }) => {
                if (timesError) console.error("Failed to persist match start/end times", timesError);
              });
              const notifMsg = `🏆 Tournament: ${match.t1.p1Name}${match.t1.p2Name ? ` & ${match.t1.p2Name}` : ""} vs ${match.t2.p1Name}${match.t2.p2Name ? ` & ${match.t2.p2Name}` : ""} — ${scoreStr}`;
              try {
                await supabase.from("site_data").upsert({
                  key: "match_alert",
                  value: { message: notifMsg, time: Date.now() },
                });
                await supabase.rpc("push_match_alert", { p_message: notifMsg });
                await supabase.functions.invoke("push-live-score", {
                  body: { message: notifMsg, match_id: matchId },
                });
                const authUser = (await supabase.auth.getUser()).data.user;
                const isUuid = (s?: string) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
                const pIds = Array.from(new Set([match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id, userId, authUser?.id].filter(isUuid)));
                if (pIds.length > 0) {
                  const rows = pIds.map(pid => ({
                    user_id: pid,
                    title: "🏆 Tournament Match Result",
                    message: notifMsg,
                    type: "match_result",
                    link: "/pulse",
                    is_read: false,
                  }));
                  const { error: notifErr } = await supabase.from("notifications").insert(rows);
                  if (notifErr) console.error("Failed to insert notification rows:", notifErr);
                  window.dispatchEvent(new Event("notifications_changed"));
                }
              } catch (e) {
                console.error("Notification push error:", e);
              }
            })();

          } catch (err: any) {
            toast.error("Failed to save tournament match: " + err.message);
          }
          return;
        }

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
          const durationMinutes = Math.max(1, Math.round((matchEndTs - matchStartTs) / 60000));
          const roundLabel = `${match.matchNumber || (match.isFriendly ? "Friendly" : "Tournament")} • ${durationMinutes}m`;
  
          const umpirePlayerId = toRealId(userId);
          let dbCategory = match.category;
          if (dbCategory === "XD") dbCategory = "Mixed Doubles";
          else if (dbCategory === "MD" || dbCategory === "WD") dbCategory = "Doubles";
          else if (dbCategory === "MS" || dbCategory === "WS") dbCategory = "Singles";

          const payload = {
            umpire_id:          umpirePlayerId,
            player1_id:         toRealId(match.t1.p1Id),
            player2_id:         toRealId(match.t2.p1Id),
            team1_partner_id:   toRealId(match.t1.p2Id),
            team2_partner_id:   toRealId(match.t2.p2Id),
            winner_id:          winnerId,
            match_score:        finalScoreStr,
            match_category:     dbCategory,
            match_round:        roundLabel,
            is_friendly:        match.isFriendly,
            sets_history:       match.setsHistory,
            started_at:         new Date(matchStartTs).toISOString(),
            ended_at:           new Date(matchEndTs).toISOString(),
          };
          
          let newMatchId = "";
          if (match.dbId) {
            // Update existing match
            await MatchService.updateMatch(match.dbId, winnerId, finalScoreStr, match.category, match.setsHistory);
            newMatchId = match.dbId;
          } else {
            const submitId = await MatchService.submitMatch(payload);
            newMatchId = submitId;
            
            if (newMatchId && !match.isFriendly) {
              // Auto-confirm tournament matches only (admin-controlled)
              // Friendly matches require opponent confirmation
              await MatchService.confirmFriendlyMatch(newMatchId);
            }
          }
  
          if (newMatchId) onMatchSaved?.(newMatchId, "friendly");
          const hasGuests = [match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id]
            .some(id => id && !realIds.has(id));
          toast.success(hasGuests ? "Match saved! Guest players are not credited to any profile." : "Match saved to profiles!");
          
          // Close UI immediately
          setHasSaved(true);

          // Background tasks: Notifications and edge functions
          (async () => {
            const notifTitle = match.isFriendly ? "🏸 Friendly Match Result" : "🏆 Tournament Match Result";
            const notifMsg = `${match.t1.p1Name}${match.t1.p2Name ? ` & ${match.t1.p2Name}` : ""} vs ${match.t2.p1Name}${match.t2.p2Name ? ` & ${match.t2.p2Name}` : ""} — ${match.setsHistory.join(", ")}`;
            try {
              await supabase.from("site_data").upsert({ key: "match_alert", value: { title: notifTitle, message: notifMsg, time: Date.now() } });
              await supabase.rpc("push_match_alert", { p_message: notifMsg });
              await supabase.functions.invoke("push-live-score", {
                body: { message: notifMsg, title: notifTitle, match_id: newMatchId || match.id },
              });
              const authUser = (await supabase.auth.getUser()).data.user;
              const isUuid = (s?: string) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
              const pIds = Array.from(new Set([match.t1.p1Id, match.t1.p2Id, match.t2.p1Id, match.t2.p2Id, userId, authUser?.id].filter(isUuid)));
              if (pIds.length > 0) {
                const rows = pIds.map(pid => ({
                  user_id: pid,
                  title: match.isFriendly ? "🏸 Friendly Match Result" : "🏆 Tournament Match Result",
                  message: notifMsg,
                  type: "match_result",
                  link: "/pulse",
                  is_read: false,
                }));
                const { error: notifErr } = await supabase.from("notifications").insert(rows);
                if (notifErr) console.error("Failed to insert notification rows:", notifErr);
                window.dispatchEvent(new Event("notifications_changed"));
              }
            } catch (e) {
              console.error("Notification push error:", e);
            }
          })();

        } catch (err: any) {
          toast.error("Failed to save: " + err.message);
        }
      } catch (err: any) {
        toast.error("Failed to save: " + err.message);
      } finally {
        setIsSaving(false);
      }
    };

    const prevStatusRef = useRef(match.status);
    useEffect(() => {
      prevStatusRef.current = match.status;
    }, [match.status]);

    const handleClose = () => {
      const liveMatchId = tournamentMatch?.id || match.dbId || match.id || userId;
      if (liveMatchId) {
        MatchService.removeLiveMatch(liveMatchId).catch(console.error);
      }
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
    breakTotalSeconds,
    breakLabel,
    hasSaved,
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
    setBreakTotalSeconds,
    setBreakLabel,
    updateMatch,
    startMatch,
    startTournamentMatch,
    handleEditSet,
    reopenSet,
    addPoint,
    deductPoint,
    forceEndSet,
    undoSetFinish,
    deleteSet,
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
    cardBadge,
    isSaving
  };
}
