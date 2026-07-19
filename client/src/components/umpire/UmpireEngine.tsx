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
import { App as CapacitorApp } from "@capacitor/app";
import { UmpireBackground } from "@/lib/umpireBackground";
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
    friendlyOnly: !isAdminEmail(userEmail) && !isTournamentUmpire,
    initialMatchState,
    tournamentMatch,
    onClose,
    onMatchSaved: saveMotionStats,
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
                <button onClick={async () => {
                  try {
                    await Pip.enterPipMode();
                  } catch (e: any) {
                    toast.info(e?.message || "Could not enter PiP mode");
                  }
                }} className="shrink-0 px-1 py-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] sm:text-xs rounded-xl flex justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 transition">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8 mb-4">
              <button onClick={() => setConfirmAction({
                title: "Cancel Match",
                message: "Are you sure you want to exit without saving? Any unsaved progress will be lost.",
                confirmLabel: "Cancel Match",
                confirmColor: "bg-rose-600 hover:bg-rose-500",
                onConfirm: () => handleClose()
              })} className="px-1 py-3 bg-slate-800 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-rose-500/30 transition shadow-sm">
                <X className="w-4 h-4 sm:w-4 sm:h-4" /> Cancel
              </button>
              
              <button 
                onClick={() => {
                  const t1Name = match.t1.p2Name ? `${match.t1.p1Name} & ${match.t1.p2Name}` : match.t1.p1Name;
                  const t2Name = match.t2.p2Name ? `${match.t2.p1Name} & ${match.t2.p2Name}` : match.t2.p1Name;
                  const fullScore = `${t1Name} [${match.t1.score} - ${match.t2.score}] ${t2Name}`;
                  supabase.from("site_data").upsert({ 
                    key: "match_alert", 
                    value: { message: `🏆 Live Score: ${fullScore}`, time: Date.now() } 
                  });
                  toast.success("Score pushed to all users!");
                }}
                className="px-1 py-3 bg-slate-800 hover:bg-sky-500/20 text-sky-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-sky-500/30 transition shadow-sm"
              >
                <Tv2 className="w-4 h-4 sm:w-4 sm:h-4" /> Push Score
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
                onConfirm: async () => {
                  try {
                    const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
                    const lm = (data?.value as Record<string, any>) || {};
                    if (lm[match.id]) {
                      delete lm[match.id];
                      await supabase.from("site_data").upsert({ key: "live_matches", value: lm });
                    }
                  } catch (e) {
                    console.error("Failed to abort broadcast", e);
                  }
                  handleClose();
                }
              })} className="px-1 py-3 bg-slate-800 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] sm:text-xs rounded-xl flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 border border-slate-700 hover:border-rose-500/30 transition shadow-sm">
                <AlertTriangle className="w-4 h-4 sm:w-4 sm:h-4" /> Abort
              </button>
            </div>
          )}

      {/* ── Takeover Request Banner (Non-blocking) ── */}
      {match.takeoverRequest?.status === "pending" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-sm pointer-events-auto">
          <div className="bg-slate-900 border border-primary/50 rounded-2xl p-4 shadow-2xl shadow-primary/20 space-y-3 animate-in slide-in-from-top-4 fade-in">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-foreground">Handover Request</h3>
                <p className="text-xs text-slate-300 truncate">
                  <span className="font-bold text-primary">{match.takeoverRequest.requesterName}</span> wants to take over.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateMatch({ takeoverRequest: { ...match.takeoverRequest!, status: "rejected" } });
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-foreground font-bold text-xs rounded-xl transition"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  updateMatch({ takeoverRequest: { ...match.takeoverRequest!, status: "approved" } });
                  toast.success("Handover approved. You can now close this match.");
                }}
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition shadow-lg"
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


