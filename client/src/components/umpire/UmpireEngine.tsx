import React, { useState, useEffect, useRef } from "react";
import { umpireService } from "@/services/umpireService";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { PlayerMotion, type MotionData } from "@/lib/playerMotion";
import { WidgetManager } from "@/lib/widgetManager";
import type { BwfMatchState, MatchEditState } from "@/types/umpire";
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";
import { useUmpireState } from "@/hooks/useUmpireState";
import { useOfflineUmpireSync } from "@/hooks/useOfflineUmpireSync";
import { useUmpireKeyboard } from "@/hooks/useUmpireKeyboard";
import { UmpireSetupScreen } from "./UmpireSetupScreen";
import { UmpireScoringScreen } from "./UmpireScoringScreen";

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
  const [isMotionTracking, _setIsMotionTracking] = useState(false);
  const [_motionData, setMotionData] = useState<MotionData | null>(null);
  const [hasGyro, setHasGyro] = useState<boolean | null>(null);

  const motionStatsRef = useRef({
    count: 0, sumMagnitude: 0, maxMagnitude: 0,
    idle: 0, walking: 0, running: 0, smash_sprint: 0,
  });

  const sensorStatsRef = useRef({
    sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0,
    total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0,
    sumSwingSpeed: 0, maxSwingSpeed: 0,
    lateralCount: 0, forwardBackCount: 0, verticalCount: 0,
    intensities: [] as number[],
    lastSec: 0,
    swingIntervals: [] as number[], lastSwingTime: 0,
    lastDominantAxis: null as "lateral" | "forwardBack" | "vertical" | null, directionChanges: 0,
  });

  const currentRallyRef = useRef({
    startedAt: Date.now(),
    count: 0, sumMagnitude: 0, maxMagnitude: 0,
    smashCount: 0, directionChanges: 0,
    lastDominantAxis: null as "lateral" | "forwardBack" | "vertical" | null,
  });

  const pendingMatchIdRef = useRef<string>("");
  const rallyCountRef = useRef(0);
  const lastPointLogLenRef = useRef(0);
  const hasAutoSavedRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isMotionTracking) return;

    PlayerMotion.startTracking().then(res => setHasGyro(res?.hasGyro ?? false)).catch(console.error);
    const listener = PlayerMotion.addListener("onMotionUpdate", (data) => {
      setMotionData(data);
      const stats = motionStatsRef.current;
      const sens = sensorStatsRef.current;

      stats.count += 1;
      stats.sumMagnitude += data.magnitude;
      stats.maxMagnitude = Math.max(stats.maxMagnitude, data.magnitude);
      if (data.intensity in stats) (stats as any)[data.intensity] += 1;

      sens.sumAccelSq += data.magnitude * data.magnitude;

      if (data.hasGyro && data.rotationRate) {
        sens.sumGyro += data.rotationRate;
        sens.sumGyroSq += data.rotationRate * data.rotationRate;
        sens.maxGyro = Math.max(sens.maxGyro, data.rotationRate);
      }

      const now = data.timestampMs ?? Date.now();

      if (data.swingDetected) {
        sens.total_swings += 1;
        if (data.swingType === "smash") sens.smash_count += 1;
        if (data.swingType === "clear") sens.clear_count += 1;
        if (data.swingType === "drive") sens.drive_count += 1;
        if (data.swingType === "net_shot") sens.net_shot_count += 1;

        const speed = data.rotationRate || data.magnitude;
        sens.sumSwingSpeed += speed;
        sens.maxSwingSpeed = Math.max(sens.maxSwingSpeed, speed);

        if (sens.lastSwingTime > 0) sens.swingIntervals.push(now - sens.lastSwingTime);
        sens.lastSwingTime = now;
      }

      if (data.magnitude > 2.0) {
        const ax = Math.abs(data.x), ay = Math.abs(data.y), az = Math.abs(data.z);
        let axis: "lateral" | "forwardBack" | "vertical";
        if (ax > ay && ax > az) { axis = "lateral"; sens.lateralCount += 1; }
        else if (ay > ax && ay > az) { axis = "vertical"; sens.verticalCount += 1; }
        else { axis = "forwardBack"; sens.forwardBackCount += 1; }

        if (sens.lastDominantAxis !== null && sens.lastDominantAxis !== axis && data.magnitude > 3.0) {
          sens.directionChanges += 1;
        }
        sens.lastDominantAxis = axis;
      }

      if (now - sens.lastSec > 1000) {
        sens.intensities.push(data.magnitude);
        sens.lastSec = now;
      }

      const rally = currentRallyRef.current;
      rally.count += 1;
      rally.sumMagnitude += data.magnitude;
      rally.maxMagnitude = Math.max(rally.maxMagnitude, data.magnitude);
      if (data.swingDetected && data.swingType === "smash") rally.smashCount += 1;
      if (data.magnitude > 2.0) {
        const ax = Math.abs(data.x), ay = Math.abs(data.y), az = Math.abs(data.z);
        const axis: "lateral" | "forwardBack" | "vertical" =
          ax > ay && ax > az ? "lateral" : ay > ax && ay > az ? "vertical" : "forwardBack";
        if (rally.lastDominantAxis !== null && rally.lastDominantAxis !== axis && data.magnitude > 3.0) {
          rally.directionChanges += 1;
        }
        rally.lastDominantAxis = axis;
      }
    });

    return () => {
      PlayerMotion.stopTracking().catch(console.error);
      listener.then(l => l.remove()).catch(console.error);
    };
  }, [isMotionTracking]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isMotionTracking) return;
    const listenerPromise = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        toast.info("Tracking continues in the background — keep IISc Shuttlers running for accurate data");
      }
    });
    return () => {
      listenerPromise.then(l => l.remove()).catch(console.error);
    };
  }, [isMotionTracking]);

  const saveMotionStats = async (matchId: string, matchSource: "friendly" | "tournament") => {
    const stats = motionStatsRef.current;
    const sens = sensorStatsRef.current;
    if (stats.count === 0) return;
    try {
      await umpireService.recordMotionStats({
        match_id: matchId,
        match_source: matchSource,
        sample_count: stats.count,
        avg_magnitude: stats.sumMagnitude / stats.count,
        max_magnitude: stats.maxMagnitude,
        idle_pct: (stats.idle / stats.count) * 100,
        walking_pct: (stats.walking / stats.count) * 100,
        running_pct: (stats.running / stats.count) * 100,
        smash_sprint_pct: (stats.smash_sprint / stats.count) * 100,
        recorded_by: userId || null,
      });

      const n = stats.count;
      const accelAvg = stats.sumMagnitude / n;
      const accelVar = Math.max(0, (sens.sumAccelSq - (stats.sumMagnitude * stats.sumMagnitude) / n) / (n > 1 ? n - 1 : 1));

      const gyroAvg = sens.sumGyro / n;
      const gyroVar = Math.max(0, (sens.sumGyroSq - (sens.sumGyro * sens.sumGyro) / n) / (n > 1 ? n - 1 : 1));

      const totalMoves = sens.lateralCount + sens.forwardBackCount + sens.verticalCount || 1;

      let fhInt = 0, shInt = 0;
      if (sens.intensities.length > 0) {
        const mid = Math.floor(sens.intensities.length / 2);
        const fh = sens.intensities.slice(0, mid);
        const sh = sens.intensities.slice(mid);
        fhInt = fh.length ? fh.reduce((a,b)=>a+b,0)/fh.length : 0;
        shInt = sh.length ? sh.reduce((a,b)=>a+b,0)/sh.length : 0;
      }

      await umpireService.recordSensorAnalytics({
        match_id: matchId,
        match_source: matchSource,
        player_id: userId,

        accel_avg: accelAvg,
        accel_peak: stats.maxMagnitude,
        accel_std: Math.sqrt(accelVar),

        gyro_avg: hasGyro ? gyroAvg : null,
        gyro_peak: hasGyro ? sens.maxGyro : null,
        gyro_std: hasGyro ? Math.sqrt(gyroVar) : null,

        total_swings: sens.total_swings,
        smash_count: sens.smash_count,
        clear_count: sens.clear_count,
        drive_count: sens.drive_count,
        net_shot_count: sens.net_shot_count,
        avg_swing_speed: sens.total_swings ? sens.sumSwingSpeed / sens.total_swings : 0,
        max_swing_speed: sens.maxSwingSpeed,

        lateral_pct: (sens.lateralCount / totalMoves) * 100,
        forward_back_pct: (sens.forwardBackCount / totalMoves) * 100,
        vertical_pct: (sens.verticalCount / totalMoves) * 100,

        first_half_intensity: fhInt,
        second_half_intensity: shInt,
        fatigue_index: fhInt > 0 ? shInt / fhInt : 1.0,

        avg_shot_interval_ms: sens.swingIntervals.length ? sens.swingIntervals.reduce((a, b) => a + b, 0) / sens.swingIntervals.length : null,
        fastest_shot_interval_ms: sens.swingIntervals.length ? Math.min(...sens.swingIntervals) : null,
        direction_changes: sens.directionChanges,
      });

      if (matchSource === "friendly" && pendingMatchIdRef.current && pendingMatchIdRef.current !== matchId) {
        await umpireService.reconcileRallyMatchId(pendingMatchIdRef.current, matchId);
      }
    } catch (err) {
      console.error("Failed to save motion stats", err);
    } finally {
      motionStatsRef.current = { count: 0, sumMagnitude: 0, maxMagnitude: 0, idle: 0, walking: 0, running: 0, smash_sprint: 0 };
      sensorStatsRef.current = { sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0, total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0, sumSwingSpeed: 0, maxSwingSpeed: 0, lateralCount: 0, forwardBackCount: 0, verticalCount: 0, intensities: [], lastSec: 0, swingIntervals: [], lastSwingTime: 0, lastDominantAxis: null, directionChanges: 0 };
      pendingMatchIdRef.current = "";
      rallyCountRef.current = 0;
      currentRallyRef.current = { startedAt: Date.now(), count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0, lastDominantAxis: null };
      lastPointLogLenRef.current = 0;
    }
  };

  const offlineSync = useOfflineUmpireSync(userId);

  const umpireState = useUmpireState({
    userId,
    userEmail,
    userName,
    isTournamentUmpire,
    friendlyOnly: !isTournamentUmpire,
    initialMatchState,
    tournamentMatch,
    onClose,
    onMatchSaved: saveMotionStats,
    onClearOfflineQueue: offlineSync.clearMatchFromQueue,
  });

  useEffect(() => {
    if (!offlineSync.isOffline || umpireState.match.status === "setup") return;
    const matchId = tournamentMatch?.id || umpireState.match.id || umpireState.match.dbId;
    if (!matchId) return;

    const timeoutId = window.setTimeout(() => {
      offlineSync.queueMatchStateUpdate(matchId, umpireState.match).catch(() => {
        toast.error("Could not save the score on this device");
      });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [offlineSync.isOffline, offlineSync.queueMatchStateUpdate, tournamentMatch?.id, umpireState.match]);

  const {
    players, match, cards, showLog, showChangeEnds, changeEndsReason, changeEndsTitle,
    showCardPanel, cardTarget, showRetireModal,
    isEditSetupOpen, isDirectScoreOpen,
    directSetsText, directWinner, breakSecondsLeft, breakTotalSeconds, breakLabel, hasSaved,
    setMatch, setShowLog, setShowChangeEnds,
    setShowCardPanel, setCardTarget, setShowRetireModal,
    setIsEditSetupOpen, setIsDirectScoreOpen,
    setDirectSetsText, setDirectWinner,
    updateMatch, startMatch, startTournamentMatch, handleEditSet, reopenSet, deleteSet, addPoint, deductPoint, forceEndSet,
    confirmChangeEnds, callLet, callServiceFault, issueCard, retireTeam, saveMatchToProfile,
    handleClose, getName, deduceCategory, startBreak, endBreak,
    selectedPlayerIds, buddyCheckPassed, serverName: _sn, receiverName: _rn,
    currentGameNum, isSaving,
    conflictState, isResolvingConflict, resolveConflictKeepServer, resolveConflictApplyCorrection, canCorrectMatch, setConflictState
  } = umpireState;

  // Keyboards
  useUmpireKeyboard({
    enabled: match.status === "playing",
    onAddPointTeam1: () => addPoint(1),
    onAddPointTeam2: () => addPoint(2),
    onDeductPointTeam1: () => deductPoint(1),
    onDeductPointTeam2: () => deductPoint(2),
    onCallLet: callLet,
    onCallServiceFault: () => callServiceFault(match.serverTeam),
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let fallbackId: NodeJS.Timeout;
    if (match.status === "playing") {
      hasAutoSavedRef.current = false;
      toast.dismiss("auto-save");
    } else if (match.status === "finished" && !hasSaved && !isSaving && !hasAutoSavedRef.current) {
      hasAutoSavedRef.current = true;

      toast("Match Finished!", {
        id: "auto-save",
        description: "Auto-saving in 3 seconds...",
        duration: 3500,
        action: {
          label: "Undo",
          onClick: () => {
            clearTimeout(timeoutId);
            updateMatch({ status: "playing" });
            hasAutoSavedRef.current = false;
          }
        }
      });

      timeoutId = setTimeout(() => {
        saveMatchToProfile();
      }, 3000);
    } else if (match.status === "finished" && !hasSaved && !isSaving) {
      fallbackId = setTimeout(() => {
        saveMatchToProfile();
      }, 30000);
    }
    return () => { clearTimeout(timeoutId); clearTimeout(fallbackId); };
  }, [match.status, hasSaved, isSaving, saveMatchToProfile, updateMatch]);

  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === "hidden" && match.status === "finished" && !hasSaved && !isSaving) {
        saveMatchToProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [match.status, hasSaved, isSaving, saveMatchToProfile]);

  useEffect(() => {
    if (!isMotionTracking || !match?.pointLog) return;
    const log = match.pointLog;
    if (log.length <= lastPointLogLenRef.current) {
      lastPointLogLenRef.current = log.length;
      return;
    }
    const entry = log[log.length - 1];
    if (entry.team !== 1 && entry.team !== 2) {
      lastPointLogLenRef.current = log.length;
      return;
    }
    const rally = currentRallyRef.current;
    const now = Date.now();
    if (rally.count > 0) {
      const matchSource: "friendly" | "tournament" = (tournamentMatch || match.isTournamentMatch) ? "tournament" : "friendly";
      const stableId = tournamentMatch?.id || match.dbId;
      if (!stableId && !pendingMatchIdRef.current) {
        pendingMatchIdRef.current = crypto.randomUUID();
      }
      const matchId = stableId || pendingMatchIdRef.current;
      rallyCountRef.current += 1;
      umpireService.insertRallyStats({
        match_id: matchId,
        match_source: matchSource,
        game_num: entry.gameNum,
        rally_number: rallyCountRef.current,
        scoring_team: entry.team,
        t1_score: entry.t1Score,
        t2_score: entry.t2Score,
        started_at: new Date(rally.startedAt).toISOString(),
        duration_ms: Math.max(0, now - rally.startedAt),
        shot_count: rally.count,
        smash_count: rally.smashCount,
        avg_intensity: rally.sumMagnitude / rally.count,
        peak_intensity: rally.maxMagnitude,
        direction_changes: rally.directionChanges,
        recorded_by: userId || null,
      }).catch((error) => { console.error("Failed to save rally stats", error); });
    }
    currentRallyRef.current = { startedAt: now, count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0, lastDominantAxis: null };
    lastPointLogLenRef.current = log.length;
  }, [match?.pointLog, isMotionTracking, tournamentMatch, match.isTournamentMatch, match.dbId, userId]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || match?.status !== "playing") return;
    const t1Label = match.t1.teamName || match.t1.p1Name;
    const t2Label = match.t2.teamName || match.t2.p1Name;

    WidgetManager.updateWidget({
      title: match.tournament || "IISc Badminton",
      team1: t1Label,
      score1: String(match.t1.score),
      team2: t2Label,
      score2: String(match.t2.score),
    }).catch(console.error);
  }, [match?.t1.score, match?.t2.score, match?.status, match?.tournament, match.t1.teamName, match.t1.p1Name, match.t2.teamName, match.t2.p1Name]);

  const friendlyOnly = !isTournamentUmpire;

  if (match.status === "setup") {
    return (
      <div className="relative max-w-xl mx-auto">
        <UmpireSetupScreen
          tournamentMatch={tournamentMatch}
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
          startTournamentMatch={startTournamentMatch}
          buddyCheckPassed={buddyCheckPassed}
          selectedPlayerIds={selectedPlayerIds}
        />
      </div>
    );
  }

  return (
    <>
      <UmpireScoringScreen
        match={match}
        cards={cards}
        updateMatch={updateMatch}
        addPoint={addPoint}
        deductPoint={deductPoint}
        forceEndSet={forceEndSet}
        reopenSet={reopenSet}
        deleteSet={deleteSet}
        handleEditSet={handleEditSet}
        callLet={callLet}
        callServiceFault={callServiceFault}
        issueCard={issueCard}
        retireTeam={retireTeam}
        saveMatchToProfile={saveMatchToProfile}
        handleClose={handleClose}
        startBreak={startBreak}
        endBreak={endBreak}
        isSaving={isSaving}
        hasSaved={hasSaved}
        isSyncing={isSaving}
        tournamentMatch={tournamentMatch}
        offlineSync={offlineSync}
        showChangeEnds={showChangeEnds}
        changeEndsReason={changeEndsReason}
        changeEndsTitle={changeEndsTitle}
        confirmChangeEnds={confirmChangeEnds}
        showCardPanel={showCardPanel}
        setShowCardPanel={setShowCardPanel}
        cardTarget={cardTarget}
        setCardTarget={setCardTarget}
        showRetireModal={showRetireModal}
        setShowRetireModal={setShowRetireModal}
        isDirectScoreOpen={isDirectScoreOpen}
        setIsDirectScoreOpen={setIsDirectScoreOpen}
        directWinner={directWinner}
        setDirectWinner={setDirectWinner}
        directSetsText={directSetsText}
        setDirectSetsText={setDirectSetsText}
        showLog={showLog}
        setShowLog={setShowLog}
        breakSecondsLeft={breakSecondsLeft}
        breakTotalSeconds={breakTotalSeconds}
        breakLabel={breakLabel}
        currentGameNum={currentGameNum}
        setIsEditSetupOpen={setIsEditSetupOpen}
        conflictState={conflictState}
        isResolvingConflict={isResolvingConflict}
        canCorrectMatch={canCorrectMatch}
        onKeepServerResult={resolveConflictKeepServer}
        onApplyCorrection={resolveConflictApplyCorrection}
        onCloseConflictModal={() => setConflictState(null)}
      />

      {isEditSetupOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setIsEditSetupOpen(false)}
        >
          <div
            className="w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 rounded-3xl"
            onClick={e => e.stopPropagation()}
          >
            <UmpireSetupScreen
              tournamentMatch={tournamentMatch}
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
              startTournamentMatch={startTournamentMatch}
              buddyCheckPassed={buddyCheckPassed}
              selectedPlayerIds={selectedPlayerIds}
            />
          </div>
        </div>
      )}
    </>
  );
}
