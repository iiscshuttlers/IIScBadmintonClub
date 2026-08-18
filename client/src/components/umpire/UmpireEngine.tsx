import { UmpireSetupFlow } from "./UmpireSetupFlow";
import { PlayerSelect } from "./PlayerSelect";
import { ScoringLogic, type MatchFormat } from "@/lib/umpire/scoringLogic";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Trophy, Plus, Minus, RotateCcw, X, Edit3, Trash2, ShieldAlert, Zap, Users, UserPlus, Info, Save, ChevronLeft, ChevronRight, CornerUpLeft, MessageSquare, AlertTriangle, Play, Shield, Shuffle, Timer, History, RefreshCw, Settings, ArrowLeftRight, Flag, ChevronDown, ChevronUp, Repeat, Tv2, MonitorPlay, ActivitySquare, Camera, Edit2, Loader2, BookOpen, MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Pip } from "@/lib/pip";
import { PlayerMotion, type MotionData } from "@/lib/playerMotion";
import { WidgetManager } from "@/lib/widgetManager";

// ── Types ─────────────────────────────────────────────────────────────────────

import type { PlayerSlim as Player } from "@/types";
import type { BwfMatchState, MatchEditState, PointLogEntry } from "@/types/umpire";

type CardType = "yellow" | "red" | "black";
type CardTarget = "t1p1" | "t1p2" | "t2p1" | "t2p2";

import { CourtVisual } from "./CourtVisual";
import { ChangeEndsModal, DisciplineCardModal, RetireModal, DirectScoreModal, ConfirmActionModal } from "./MatchModals";
import { useUmpireState } from "@/hooks/useUmpireState";
import { useOfflineUmpireSync } from "@/hooks/useOfflineUmpireSync";
import { MatchService } from "@/services/matchService";



// ── Player Select ─────────────────────────────────────────────────────────────


// ── UmpireEngine ──────────────────────────────────────────────────────────────

import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";

function buildFloatingTeamLabel(team: BwfMatchState["t1"]): string {
  if (team.teamName) return team.teamName;
  return team.p2Name ? `${team.p1Name} & ${team.p2Name}` : team.p1Name;
}

function buildFloatingTeamsLabel(match: BwfMatchState): string {
  return `${buildFloatingTeamLabel(match.t1)} vs ${buildFloatingTeamLabel(match.t2)}`;
}

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
  const [showSettings, setShowSettings] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isMotionTracking, setIsMotionTracking] = useState(false);
  const [motionData, setMotionData] = useState<MotionData | null>(null);
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

  // Per-rally accumulator: reset every time match.pointLog grows by one (see the
  // pointLog-watching effect below). Buffered client-side and bulk-inserted once
  // matchId is known (friendly matches only get an id once saved).
  const currentRallyRef = useRef({
    startedAt: Date.now(),
    count: 0, sumMagnitude: 0, maxMagnitude: 0,
    smashCount: 0, directionChanges: 0,
    lastDominantAxis: null as "lateral" | "forwardBack" | "vertical" | null,
  });
  // Friendly matches only get a real DB id once saveMatchToProfile succeeds at
  // match end. Until then, rallies are inserted under this random id and
  // reconciled to the real one in saveMotionStats.
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

      // Mirror into the current-rally accumulator (reset on each pointLog entry)
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

  // ── App-lifecycle safety net (Phase 4) ──
  // The wake lock and native timestamps (Phases 1-2) are what actually keep
  // tracking accurate in the background; this just gives the umpire visibility
  // instead of silent uncertainty on older/degraded devices.
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
      await supabase.from("match_motion_stats").upsert({
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
      }, { onConflict: "match_id,match_source" });

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

      await supabase.from("match_sensor_analytics").upsert({
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
      }, { onConflict: "match_id,match_source,player_id" });

      // Reconcile rallies already inserted under a pending id (friendly matches
      // with no dbId yet when tracking started) to the real match id.
      if (matchSource === "friendly" && pendingMatchIdRef.current && pendingMatchIdRef.current !== matchId) {
        const { error: reconcileErr } = await supabase.from("match_rally_stats")
          .update({ match_id: matchId })
          .eq("match_id", pendingMatchIdRef.current)
          .eq("match_source", "friendly");
        if (reconcileErr) console.error("Failed to reconcile rally match id", reconcileErr);
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
  });

  const offlineSync = useOfflineUmpireSync();

  const queryClient = useQueryClient();
  const { mutate: addPointMutate, isPending: isSyncing } = useMutation({
    mutationFn: async ({ team, matchId }: { team: 1 | 2, matchId: string }) => {
      if (offlineSync.isOffline && umpireState.match) {
        offlineSync.queueMatchStateUpdate(umpireState.match);
        return;
      }
      // Score updates are automatically persisted via updateMatch in useUmpireState
    },
    onMutate: async ({ team }) => {
      await queryClient.cancelQueries({ queryKey: ["matches"] });
      const previousMatch = queryClient.getQueryData(["matches"]);
      umpireState.addPoint(team);
      return { previousMatch };
    },
    onError: (err, variables, context) => {
      toast.error("Failed to update score — please try again");
      if (context?.previousMatch) {
        queryClient.setQueryData(["matches"], context.previousMatch);
      }
    },
  });

  const {
    players, match, cards, showLog, showChangeEnds, changeEndsReason, changeEndsTitle,
    pendingBreakAfterEnds, showCardPanel, cardTarget, showRetireModal,
    isEditSetupOpen, showToolsMenu, isDirectScoreOpen, showFullTimer,
    directSetsText, directWinner, myBuddies, breakSecondsLeft, breakTotalSeconds, breakLabel, hasSaved,
    setMatch, setCards, setShowLog, setShowChangeEnds, setChangeEndsReason,
    setPendingBreakAfterEnds, setShowCardPanel, setCardTarget, setShowRetireModal,
    setIsEditSetupOpen, setShowToolsMenu, setIsDirectScoreOpen, setShowFullTimer,
    setDirectSetsText, setDirectWinner, setBreakSecondsLeft, setBreakLabel,
    updateMatch, startMatch, startTournamentMatch, handleEditSet, reopenSet, addPoint, deductPoint, forceEndSet,
    confirmChangeEnds, callLet, callServiceFault, issueCard, retireTeam, saveMatchToProfile,
    handleClose, getName, getGender, deduceCategory, startBreak, endBreak,
    selectedPlayerIds, buddyCheckPassed, isDoubles, serverName, receiverName,
    currentGameNum, serverScore, receiverScore, cardBadge, isSaving
  } = umpireState;

  // A doubles side may have only a name for the partner (never linked to a
  // player record), so presence must be tested on id OR name — testing p2Id
  // alone made the serve controls vanish for bracket-entered pairs.
  const sideIsDoubles = (side?: { p2Id?: string; p2Name?: string }) => !!(side?.p2Id || side?.p2Name);
  const servingTeamIsDoubles = sideIsDoubles(match?.serverTeam === 1 ? match?.t1 : match?.t2);
  const receivingTeamIsDoubles = sideIsDoubles(match?.serverTeam === 1 ? match?.t2 : match?.t1);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
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
    }
    return () => clearTimeout(timeoutId);
  }, [match.status, hasSaved, isSaving, saveMatchToProfile, updateMatch]);


  // Render variables
  // friendlyOnly = no tournament in progress OR user lacks umpire/admin role
  const friendlyOnly = !isTournamentUmpire;

  // ── Rally segmentation (Path A) ──
  // Every new match.pointLog entry is a scored point, i.e. a rally boundary with a
  // real timestamp — no stillness heuristic needed here. Flush the sensor
  // accumulator collected since the last point and persist the rally row
  // immediately (rather than buffering to match-end) so an OS process kill
  // mid-match can't silently lose already-completed rallies. Tournament/edit
  // matches already have a stable id; friendly matches without one yet use a
  // pending random id, reconciled to the real id in saveMotionStats.
  useEffect(() => {
    if (!isMotionTracking || !match?.pointLog) return;
    const log = match.pointLog;
    if (log.length <= lastPointLogLenRef.current) {
      lastPointLogLenRef.current = log.length;
      return;
    }
    const entry = log[log.length - 1];
    if (entry.team !== 1 && entry.team !== 2) {
      // Let/fault entries don't end a rally
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
      supabase.from("match_rally_stats").insert({
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
      }).then(({ error }) => { if (error) console.error("Failed to save rally stats", error); });
    }
    currentRallyRef.current = { startedAt: now, count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0, lastDominantAxis: null };
    lastPointLogLenRef.current = log.length;
  }, [match?.pointLog, isMotionTracking]);


  // Sync Home Screen Widget with live score
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || match?.status !== "playing") return;
    const t1Label = match.t1.teamName || match.t1.p1Name;
    const t2Label = match.t2.teamName || match.t2.p1Name;
    
    // Push to Home Screen Widget
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
      <div className="bg-slate-900 border border-slate-800 rounded-4xl p-5 sm:p-6 text-on-accent max-w-lg mx-auto shadow-2xl">
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
          <button onClick={handleClose} className="p-2 hover:bg-slate-800 rounded-xl text-muted-foreground hover:text-on-accent transition">
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
        className="fixed inset-0 z-50 flex flex-col justify-end p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
        onClick={() => setIsEditSetupOpen(false)}
      >
        <div 
          className="w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 rounded-3xl" 
          onClick={e => e.stopPropagation()}
        >
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
    <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800/50 rounded-[2rem] p-3 sm:p-6 text-on-accent max-w-4xl lg:max-w-5xl mx-auto shadow-2xl shadow-black/40 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-sky-400 to-primary bg-[length:200%_100%] animate-[shimmer_3s_ease-in-out_infinite]" />
      {renderSetupOverlay()}
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

      {/* ── Header Area ── */}
      <div className="flex items-start justify-between gap-3 mb-3 mt-2">
        {/* Left Side: Live Badge & Game Info */}
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
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Match Finished</span>
              <div className="text-slate-500 text-[10px] sm:text-[11px] font-bold truncate">
                {match.isFriendly ? "Friendly" : `Tournament · ${match.matchNumber || "—"}`} · {match.inferredCategory || match.category}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Exit & Offline Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button onClick={handleClose} className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-white font-bold text-[10px] sm:text-xs rounded-full flex justify-center items-center gap-1.5 border border-slate-700/50 hover:border-slate-600 backdrop-blur-sm transition cursor-pointer shadow-sm">
            <X className="w-3.5 h-3.5" /> Exit
          </button>
          {offlineSync.isOffline && (
            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] sm:text-[10px] rounded-full flex justify-center items-center gap-1.5 animate-pulse backdrop-blur-sm">
              ⚡ Offline ({offlineSync.queuedCount})
            </span>
          )}
        </div>
      </div>

      {/* ── Finished Screen ── */}
      {match.status === "finished" ? (
        <div className="text-center py-2">
          {/* Trophy header */}
          <div className="flex flex-col items-center gap-1 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-1 shadow-[0_0_24px_rgba(251,191,36,0.12)]">
              <Trophy className="w-6 h-6 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">{match.retiredTeam ? "Match Retired" : "Match Finished!"}</h2>
          </div>

          {/* Winner card */}
          <div className="mx-auto max-w-xs mb-4 px-4 py-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20 backdrop-blur-sm">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Winner</div>
            <p className="text-base font-black text-amber-300 leading-tight">
              {match.winner === 1
                ? (match.t1.p1Name + (match.t1.p2Name ? ` / ${match.t1.p2Name}` : ""))
                : (match.t2.p1Name + (match.t2.p2Name ? ` / ${match.t2.p2Name}` : ""))
              }
            </p>
            <p className="text-emerald-400 font-black text-sm mt-1 tabular-nums">
              {match.setsHistory.join("  ·  ")}{match.retiredTeam ? ` (T${match.retiredTeam} Retired)` : ""}
            </p>
          </div>

          <div className="flex flex-row items-center justify-center gap-2 max-w-xs mx-auto">
            <button disabled={isSaving} onClick={saveMatchToProfile} className={`flex-1 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 ${hasSaved ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25" : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]"}`}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {isSaving ? "Saving..." : hasSaved ? "Save Again" : "Save Result"}
            </button>
            <button disabled={isSaving} onClick={() => {
              MatchService.upsertLiveMatch(match.id, match)
                .then(() => toast.success("Score pushed to Live Feed"))
                .catch(err => toast.error("Failed to push score"));
            }} className="flex-1 px-3 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-sky-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95">
              <RefreshCw className="w-3.5 h-3.5" /> Push Score
            </button>
            <button disabled={isSaving} onClick={handleClose} className="flex-1 px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-white/[0.08] flex items-center justify-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95">
              <X className="w-3.5 h-3.5 text-rose-400" /> Close
            </button>
          </div>
          <button onClick={() => updateMatch({ status: "playing", winner: undefined, retiredTeam: undefined })} className="mt-3 text-[9px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest underline underline-offset-2 block mx-auto cursor-pointer transition">
            Wait, add a set / resume match
          </button>
        </div>
      ) : (
        <>
        {/* ── Break Timer Banner (always visible when timer running) ── */}
        {breakSecondsLeft !== null && (
          <div className="w-full bg-amber-500/[0.07] border border-amber-500/20 rounded-2xl mb-3 overflow-hidden backdrop-blur-sm">
            {/* Progress bar */}
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
              <div className="flex items-center gap-3">
                <span className={`font-black text-2xl sm:text-3xl tabular-nums tracking-tighter ${breakSecondsLeft < 0 ? 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]'}`}>
                  {breakSecondsLeft < 0 ? "-" : ""}{Math.floor(Math.abs(breakSecondsLeft) / 60).toString().padStart(2, "0")}:{(Math.abs(breakSecondsLeft) % 60).toString().padStart(2, "0")}
                </span>
                <button onClick={endBreak} className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-bold text-[10px] rounded-xl border border-white/[0.08] transition backdrop-blur-sm">
                  End
                </button>
              </div>
            </div>
          </div>
        )}

        <>
          {/* ── Score Cards (HERO — tap card to add a point) ── */}
          {/* --card-gap must track the gap classes: the sliding cards move one
              column width plus exactly this gap. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6 [--card-gap:0.5rem] sm:[--card-gap:1rem] md:[--card-gap:1.5rem]">
            {([1, 2] as const).map((team) => {
              const t = team === 1 ? match.t1 : match.t2;
              const isServing = match.serverTeam === team;
              // The cards trade sides when ends change, mirroring the real court.
              // This used to be `style={{ order }}`, and CSS `order` is not
              // animatable — the two cards teleported past each other in a single
              // frame, right at the moment an umpire is about to tap. Sliding them
              // with a transform keeps the same final layout but makes the swap
              // legible, so it's obvious which card is now which.
              // Each card travels one column width plus the grid gap.
              const swapOffset =
                team === 1
                  ? "translateX(calc(100% + var(--card-gap)))"
                  : "translateX(calc(-100% - var(--card-gap)))";
              
              const teamGradient = isServing 
                ? team === 1 
                  ? "bg-gradient-to-b from-emerald-950/80 to-emerald-900/30 border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.15)]"
                  : "bg-gradient-to-b from-sky-950/80 to-sky-900/30 border-sky-500/60 shadow-[0_0_40px_rgba(14,165,233,0.15)]"
                : "bg-gradient-to-b from-slate-800/60 to-slate-900/40 border-slate-700/40";
              
              // Keep the score's colour fixed per team. It used to switch between
              // full and 60%-opacity (and sky-400 vs sky-300) every time serve
              // changed, so both numbers visibly shifted colour on every rally.
              // Serve is signalled by the glow, border and "Serving" label instead.
              const teamTextColor = team === 1 ? "text-emerald-400" : "text-sky-400";
              const scoreGlow = isServing
                ? team === 1
                  ? `${teamTextColor} drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]`
                  : `${teamTextColor} drop-shadow-[0_0_20px_rgba(14,165,233,0.4)]`
                : teamTextColor;
              
              const servingColor = team === 1 ? "text-emerald-400" : "text-sky-400";
              const servingDotColor = team === 1 ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.6)]";

              return (
                <div
                  key={team}
                  data-testid={`btn-add-point-t${team}`}
                  onClick={() => !isSyncing && addPointMutate({ team, matchId: match.id || tournamentMatch?.id || "" })}
                  style={{ transform: match.endsSwapped ? swapOffset : "translateX(0)" }}
                  className={`relative cursor-pointer select-none rounded-[1.25rem] sm:rounded-3xl border-2 p-2 sm:p-4 md:p-6 flex flex-col items-center backdrop-blur-sm transition-[transform,background-color,border-color,box-shadow] duration-500 ease-in-out active:duration-75 active:scale-[0.97] ${teamGradient}`}
                >
                  {/* Minus (corner) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deductPoint(team); }}
                    className="absolute top-2 left-2 w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-black/30 hover:bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 z-10 transition"
                    aria-label="Deduct point"
                  >
                    <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                  </button>

                  {/* Names */}
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

                  {/* S / R indicator */}
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

                  {/* Score */}
                  <div data-testid={`t${team}-score`} className={`text-[4.5rem] sm:text-[7rem] md:text-[9rem] leading-none font-black tracking-tighter tabular-nums transition-all duration-300 ${scoreGlow}`}>
                    {t.score}
                  </div>

                  {/* Games won */}
                  <div className="mt-1.5 sm:mt-2 flex justify-center gap-1.5">
                    {Array.from({ length: Math.ceil(match.bestOfSets / 2) }).map((_, i) => (
                      <div key={i} className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all ${i < t.games ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] scale-110" : "bg-slate-700/60 border border-slate-600/50"}`} />
                    ))}
                  </div>

                  {/* Tap hint */}
                  <div className="mt-1.5 text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.15em] text-slate-500 flex items-center gap-1">
                    <Plus className="w-2 h-2" /> Tap to score
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Score Announcement ──
              Team 1 is always on the left in a fixed team colour. This used to be
              server-first with role-based colours (emerald = server, sky =
              receiver), so both names and both scores swapped sides *and* changed
              colour on every service change — the single biggest source of visual
              churn on this screen. The serving side is now marked with a pulsing
              dot instead of by reordering. */}
          <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4 px-4 py-2 sm:py-2.5 mx-auto w-fit rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity duration-300 ${match.serverTeam === 1 ? "bg-emerald-400 animate-pulse" : "bg-transparent"}`} />
            <span className="text-emerald-400 text-[9px] sm:text-[11px] font-black uppercase tracking-wider truncate max-w-[80px] sm:max-w-none">
              {match.t1.p2Name ? `${match.t1.p1Name} / ${match.t1.p2Name}` : match.t1.p1Name}
            </span>
            <span className="text-emerald-400 text-base sm:text-lg font-black tabular-nums">{match.t1.score}</span>
            <span className="text-slate-600 text-xs font-black">—</span>
            <span className="text-sky-400 text-base sm:text-lg font-black tabular-nums">{match.t2.score}</span>
            <span className="text-sky-400 text-[9px] sm:text-[11px] font-black uppercase tracking-wider truncate max-w-[80px] sm:max-w-none">
              {match.t2.p2Name ? `${match.t2.p1Name} / ${match.t2.p2Name}` : match.t2.p1Name}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity duration-300 ${match.serverTeam === 2 ? "bg-sky-400 animate-pulse" : "bg-transparent"}`} />
            {match.setsHistory.length > 0 && <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 ml-1">({match.setsHistory.join(", ")})</span>}
          </div>

          {/* ── Court Visual ── */}
          <div className="flex justify-center mt-2 sm:mt-3">
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
              isDoubles={sideIsDoubles(match.t1) || sideIsDoubles(match.t2)}
              endsSwapped={match.endsSwapped}
            />
          </div>

          {/* ── 3-Tab Controls Row ── */}
          <div className="mt-3 sm:mt-4">
            <div className="flex gap-1.5 w-full">
              {/* Settings Tab */}
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

              {/* Break Tab */}
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

              {/* More Tab */}
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

            {/* Content Area */}
            <div className={`transition-all duration-300 overflow-hidden ${showSettings || showBreak || showMore ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"}`}>
              <div className={`rounded-2xl border bg-white/[0.02] backdrop-blur-sm p-2 pt-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 ${showBreak && breakSecondsLeft !== null ? "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : "border-white/[0.06]"}`}>
                {showSettings && (
                  <>
                  <button onClick={() => updateMatch({ endsSwapped: !match.endsSwapped })} className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Swap Ends
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
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-white/[0.12] transition">
                      <Repeat className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Switch Server
                    </button>
                  )}
                  {receivingTeamIsDoubles && (
                    <button
                      onClick={() => {
                        const flip = (v: 0 | 1 | undefined) => ((v ?? 0) === 0 ? 1 : 0) as 0 | 1;
                        const nextReceiver = (match.receiverPlayerIndex === 0 ? 1 : 0) as 0 | 1;
                        updateMatch({
                          receiverPlayerIndex: nextReceiver,
                          receiverP0AtTop: nextReceiver === 0,
                          ...(match.serverTeam === 1
                            ? { t2RightCourt: flip(match.t2RightCourt) }
                            : { t1RightCourt: flip(match.t1RightCourt) }),
                        });
                      }}
                      className="py-2.5 px-2 bg-white/[0.04] hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 border border-white/[0.06] hover:border-amber-500/30 transition">
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
                    <button key={label as string} onClick={() => startBreak(secs as number, lbl as string)}
                      className={`py-2.5 font-bold text-[10px] sm:text-xs rounded-xl transition-all flex justify-center items-center gap-1.5 ${
                        label === "1 min"
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                          : "bg-white/[0.03] hover:bg-amber-500/10 border border-white/[0.06] hover:border-amber-500/30 text-slate-400 hover:text-amber-300"
                      }`}>
                      <Timer className="w-3.5 h-3.5 shrink-0" />{label as string}
                    </button>
                  ))}
                  </>
                )}

                {showMore && (
                  <>
                  <button onClick={forceEndSet}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    <Plus className="w-3.5 h-3.5 shrink-0" /> Add Set
                  </button>
                  <button onClick={callLet}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 text-slate-300 hover:text-blue-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    ↩ Let
                  </button>
                  <button onClick={() => callServiceFault(match.serverTeam)}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-orange-500/10 border border-white/[0.06] hover:border-orange-500/30 text-slate-300 hover:text-orange-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    ✗ Fault
                  </button>
                  <button onClick={() => { setShowCardPanel(true); setCardTarget(null); }}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-yellow-500/10 border border-white/[0.06] hover:border-yellow-500/30 text-slate-300 hover:text-yellow-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    <Flag className="w-3.5 h-3.5 shrink-0" /> Cards
                  </button>
                  <button onClick={() => setShowRetireModal(true)}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/30 text-slate-300 hover:text-rose-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Retire
                  </button>
                  <button onClick={() => setShowLog(!showLog)}
                    className="py-2.5 px-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1.5 transition">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" /> Log ({match.pointLog.length})
                  </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
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
                    <th className="px-2 sm:px-4 py-3 border-b border-slate-700 text-center font-black text-sky-400 w-[30%]">
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
                            className="w-10 sm:w-16 bg-slate-900 border border-slate-600 rounded-lg px-1 sm:px-2 py-1 text-center font-bold text-sky-400 outline-none focus:border-sky-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-2 sm:px-4 py-3 font-semibold text-[10px] sm:text-xs text-muted-foreground text-center">
                          <div className="line-clamp-2 break-words leading-tight">{winnerStr}</div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center">
                          <button onClick={() => reopenSet(i)} className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-xs group relative" title="Reopen Set in Score Panel">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!!match.winner && (
                    <tr className="bg-primary/80/20">
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
                    <span className="text-sky-400 font-bold">T2: {match.t2.p1Name}{match.t2.p2Name && ` / ${match.t2.p2Name}`}</span>
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

          {/* ── Match Action Buttons (Bottom Dock) ── */}
          {match.status === "playing" && (
            <div className="mt-5 mb-1 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button onClick={() => setConfirmAction({
                  title: "Cancel Match",
                  message: "Are you sure you want to exit without saving? Any unsaved progress will be lost.",
                  confirmLabel: "Cancel Match",
                  confirmColor: "bg-rose-600 hover:bg-rose-500",
                  onConfirm: () => handleClose()
                })} className="px-2 py-3 bg-white/[0.03] hover:bg-rose-500/10 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-white/[0.05] hover:border-rose-500/20 transition active:scale-95">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                
                <button 
                  onClick={async () => {
                    const t1Name = match.t1.p2Name ? `${match.t1.p1Name} & ${match.t1.p2Name}` : match.t1.p1Name;
                    const t2Name = match.t2.p2Name ? `${match.t2.p1Name} & ${match.t2.p2Name}` : match.t2.p1Name;
                    const setsHistory = match.setsHistory.length > 0 ? match.setsHistory.join(", ") : "Set 1";
                    const matchTitle = match.category ? `🏸 ${match.category} Live Score` : "🏸 Live Match Score";
                    const scoreMessage = `${t1Name} vs ${t2Name} | Sets: ${setsHistory} | Game: ${match.t1.score}-${match.t2.score}`;
                    try {
                      await supabase.from("site_data").upsert({ 
                        key: "match_alert", 
                        value: { title: matchTitle, message: scoreMessage, time: Date.now() } 
                      });
                    } catch (e) {
                      console.warn("Failed to upsert site_data directly, falling back to RPC", e);
                    }
                    const { error } = await supabase.rpc("push_match_alert", {
                      p_message: scoreMessage,
                    });
                    const { data: pushResp, error: pushErr } = await supabase.functions.invoke("push-live-score", {
                      body: { message: scoreMessage, title: matchTitle, match_id: match.id },
                    });
                    if (error && pushErr) {
                      toast.error("Failed to push score — " + error.message);
                    } else if (pushErr) {
                      toast.warning("Live banner shown, but device push failed: " + pushErr.message);
                    } else if (pushResp?.total === 0) {
                      toast.success("Score pushed! (No devices registered for push notifications)");
                    } else {
                      toast.success(`Score pushed to all users! (${pushResp?.sent ?? 0} devices notified)`);
                    }
                  }}
                  className="px-2 py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-sky-500/15 hover:border-sky-500/30 transition active:scale-95"
                >
                  <Tv2 className="w-3.5 h-3.5" /> Push Score
                </button>
                <button onClick={() => setConfirmAction({
                  title: "Finish Match",
                  message: "Are you sure you want to forcefully finish this match?",
                  confirmLabel: "Finish Match",
                  confirmColor: "bg-primary hover:bg-primary",
                  onConfirm: () => updateMatch({ status: 'finished', winner: match.t1.games >= match.t2.games ? 1 : 2 })
                })} className="px-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-emerald-500/20 hover:border-emerald-500/40 transition active:scale-95 shadow-[0_0_16px_rgba(16,185,129,0.08)]">
                  <Save className="w-3.5 h-3.5" /> Finish
                </button>
                <button onClick={() => setConfirmAction({
                  title: "Abort Match",
                  message: "Are you sure you want to permanently abort this match and delete its records?",
                  confirmLabel: "Abort Match",
                  confirmColor: "bg-rose-600 hover:bg-rose-500",
                  onConfirm: async () => {
                    try {
                      const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").maybeSingle();
                      const lm = (data?.value as Record<string, any>) || {};
                      if (lm[match.id]) {
                        delete lm[match.id];
                        await supabase.from("site_data").upsert({ key: "live_matches", value: lm });
                      }
                      if (!match.isFriendly) {
                        const tId = tournamentMatch?.id || match.dbId || match.id;
                        if (tId) {
                          await supabase.from("tournament_matches").update({ status: "scheduled" }).eq("id", tId);
                        }
                      }
                    } catch (e) {
                      console.error("Failed to abort broadcast", e);
                    }
                    handleClose();
                  }
                })} className="px-2 py-3 bg-white/[0.03] hover:bg-rose-500/10 text-rose-500 font-bold text-[10px] sm:text-xs rounded-xl flex flex-row justify-center items-center gap-1.5 border border-white/[0.05] hover:border-rose-500/20 transition active:scale-95">
                  <AlertTriangle className="w-3.5 h-3.5" /> Abort
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


