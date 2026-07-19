import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { ActivitySquare, Play, Square, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PlayerMotion, type MotionData } from "@/lib/playerMotion";
import { ScreenLockOverlay } from "./ScreenLockOverlay";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import HealthConnect from "@/lib/healthConnect";

export function SelfMotionTracker({ userId, onSaved }: { userId: string, onSaved?: () => void }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [motionData, setMotionData] = useState<MotionData | null>(null);
  const [hasGyro, setHasGyro] = useState<boolean | null>(null);

  // Polling for Heart Rate Danger Zone
  useEffect(() => {
    if (!isTracking) return;
    const hcEnabled = localStorage.getItem("hc_enabled") === "true";
    if (!hcEnabled || !Capacitor.isNativePlatform()) return;

    const checkHeartRate = async () => {
      try {
        const { available } = await HealthConnect.isAvailable();
        if (!available) return;

        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60000); // last 1 minute

        const { samples } = await HealthConnect.getHeartRateForTimeRange({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });

        if (samples && samples.length > 0) {
          const latestHr = samples[samples.length - 1].bpm;
          if (latestHr >= 190) { // Danger Zone Threshold
            await Haptics.impact({ style: ImpactStyle.Heavy });
            setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 200);
            setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 400);
            toast.error(`DANGER ZONE: Heart rate at ${latestHr} bpm! Slow down.`);
          }
        }
      } catch (err) {
        console.error("Danger zone check failed:", err);
      }
    };

    const intervalId = setInterval(checkHeartRate, 30000); // Check every 30s
    return () => clearInterval(intervalId);
  }, [isTracking]);
  
  const motionStatsRef = useRef({
    count: 0, sumMagnitude: 0, maxMagnitude: 0,
    idle: 0, walking: 0, running: 0, smash_sprint: 0,
  });
  
  const sensorStatsRef = useRef({
    sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0,
    total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0,
    sumSwingSpeed: 0, maxSwingSpeed: 0,
    lateralCount: 0, forwardBackCount: 0, verticalCount: 0,
    intensities: [] as number[], // downsampled for fatigue (e.g., 1 per second)
    lastSec: 0,
    swingIntervals: [] as number[], lastSwingTime: 0,
    lastDominantAxis: null as "lateral" | "forwardBack" | "vertical" | null, directionChanges: 0,
  });

  // Stillness-based rally segmentation: there's no live scorer here, so a rally
  // boundary is inferred from a sustained idle gap in the motion stream instead
  // of a point-scored event (contrast with UmpireEngine's pointLog-driven flush).
  const IDLE_GAP_MS = 2500;
  const MIN_RALLY_MS = 1000;
  const MIN_RALLY_SAMPLES = 5;
  const rallySegRef = useRef({
    rallyStart: 0, idleSince: 0, closed: true,
    count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0,
    lastDominantAxis: null as "lateral" | "forwardBack" | "vertical" | null,
  });
  // Generated at the START of tracking (not stop-time) so every rally can be
  // persisted immediately as it closes, instead of buffered until Stop & Save.
  const matchIdRef = useRef<string>("");
  const rallyCountRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isTracking) return;

    PlayerMotion.startTracking().then(res => setHasGyro(res?.hasGyro ?? false)).catch(console.error);
    const listenerPromise = PlayerMotion.addListener("onMotionUpdate", (data) => {
      setMotionData(data);
      const stats = motionStatsRef.current;
      const sens = sensorStatsRef.current;
      
      stats.count += 1;
      stats.sumMagnitude += data.magnitude;
      stats.maxMagnitude = Math.max(stats.maxMagnitude, data.magnitude);
      if (data.intensity in stats) (stats as any)[data.intensity] += 1;
      
      // Extended sensor stats
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

      // Dominant axis for movement (ignore idle)
      if (data.magnitude > 2.0) {
        const ax = Math.abs(data.x), ay = Math.abs(data.y), az = Math.abs(data.z);
        let axis: "lateral" | "forwardBack" | "vertical";
        if (ax > ay && ax > az) { axis = "lateral"; sens.lateralCount += 1; }
        else if (ay > ax && ay > az) { axis = "vertical"; sens.verticalCount += 1; } // Assuming y is vertical if phone is in pocket upright
        else { axis = "forwardBack"; sens.forwardBackCount += 1; } // z is forward/back

        // Explosive direction change: dominant axis flips between consecutive high-intensity samples
        if (sens.lastDominantAxis !== null && sens.lastDominantAxis !== axis && data.magnitude > 3.0) {
          sens.directionChanges += 1;
        }
        sens.lastDominantAxis = axis;
      }

      // Fatigue tracking (sample 1 per second)
      if (now - sens.lastSec > 1000) {
        sens.intensities.push(data.magnitude);
        sens.lastSec = now;
      }

      // Rally segmentation
      const seg = rallySegRef.current;
      if (seg.rallyStart === 0) seg.rallyStart = now;

      if (data.intensity === "idle") {
        if (seg.idleSince === 0) seg.idleSince = now;
        if (now - seg.idleSince >= IDLE_GAP_MS && !seg.closed) {
          const duration = seg.idleSince - seg.rallyStart;
          if (duration >= MIN_RALLY_MS && seg.count >= MIN_RALLY_SAMPLES) {
            rallyCountRef.current += 1;
            supabase.from("match_rally_stats").insert({
              match_id: matchIdRef.current,
              match_source: "practice",
              player_id: userId,
              rally_number: rallyCountRef.current,
              started_at: new Date(seg.rallyStart).toISOString(),
              duration_ms: duration,
              shot_count: seg.count,
              smash_count: seg.smashCount,
              avg_intensity: seg.sumMagnitude / seg.count,
              peak_intensity: seg.maxMagnitude,
              direction_changes: seg.directionChanges,
              recorded_by: userId || null,
            }).then(({ error }) => { if (error) console.error("Failed to save rally stats", error); });
          }
          seg.closed = true;
        }
      } else {
        if (seg.closed) {
          seg.rallyStart = now;
          seg.count = 0; seg.sumMagnitude = 0; seg.maxMagnitude = 0;
          seg.smashCount = 0; seg.directionChanges = 0; seg.lastDominantAxis = null;
          seg.closed = false;
        }
        seg.idleSince = 0;
        seg.count += 1;
        seg.sumMagnitude += data.magnitude;
        seg.maxMagnitude = Math.max(seg.maxMagnitude, data.magnitude);
        if (data.swingDetected && data.swingType === "smash") seg.smashCount += 1;
        if (data.magnitude > 2.0) {
          const ax = Math.abs(data.x), ay = Math.abs(data.y), az = Math.abs(data.z);
          const axis: "lateral" | "forwardBack" | "vertical" =
            ax > ay && ax > az ? "lateral" : ay > ax && ay > az ? "vertical" : "forwardBack";
          if (seg.lastDominantAxis !== null && seg.lastDominantAxis !== axis && data.magnitude > 3.0) {
            seg.directionChanges += 1;
          }
          seg.lastDominantAxis = axis;
        }
      }
    });

    return () => {
      PlayerMotion.stopTracking().catch(console.error);
      listenerPromise.then(l => l.remove()).catch(console.error);
    };
  }, [isTracking]);

  const handleToggle = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.error("Motion tracking is only available in the native Android app");
      return;
    }
    
    if (isTracking) {
      // Stop and save
      setIsTracking(false);
      setIsSaving(true);
      
      const stats = motionStatsRef.current;
      const sens = sensorStatsRef.current;
      if (stats.count > 0) {
        try {
          const matchId = matchIdRef.current;

          // 1. Save to old table
          const res1 = await supabase.from("match_motion_stats").insert({
            match_id: matchId,
            match_source: "practice",
            sample_count: stats.count,
            avg_magnitude: stats.sumMagnitude / stats.count,
            max_magnitude: stats.maxMagnitude,
            idle_pct: (stats.idle / stats.count) * 100,
            walking_pct: (stats.walking / stats.count) * 100,
            running_pct: (stats.running / stats.count) * 100,
            smash_sprint_pct: (stats.smash_sprint / stats.count) * 100,
            recorded_by: userId || null,
          });
          if (res1.error) throw res1.error;
          
          // 2. Save to new table
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
          
          const res2 = await supabase.from("match_sensor_analytics").insert({
            match_id: matchId,
            match_source: "practice",
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
          if (res2.error) throw res2.error;

          // 3. Finalize any still-open rally (session ended before an idle gap closed it).
          // All earlier rallies were already persisted immediately as they closed.
          const seg = rallySegRef.current;
          if (!seg.closed && seg.count >= MIN_RALLY_SAMPLES) {
            const endTs = seg.idleSince || Date.now();
            const duration = endTs - seg.rallyStart;
            if (duration >= MIN_RALLY_MS) {
              rallyCountRef.current += 1;
              const res3 = await supabase.from("match_rally_stats").insert({
                match_id: matchId,
                match_source: "practice",
                player_id: userId,
                rally_number: rallyCountRef.current,
                started_at: new Date(seg.rallyStart).toISOString(),
                duration_ms: duration,
                shot_count: seg.count,
                smash_count: seg.smashCount,
                avg_intensity: seg.sumMagnitude / seg.count,
                peak_intensity: seg.maxMagnitude,
                direction_changes: seg.directionChanges,
                recorded_by: userId || null,
              });
              if (res3.error) console.error("Failed to save rally stats", res3.error);
            }
          }

          toast.success("Practice motion saved successfully!");
          if (onSaved) onSaved();
        } catch (err) {
          console.error("Failed to save motion stats", err);
          toast.error("Failed to save practice motion");
        }
      } else {
        toast.info("Session too short to save motion data");
      }

      motionStatsRef.current = { count: 0, sumMagnitude: 0, maxMagnitude: 0, idle: 0, walking: 0, running: 0, smash_sprint: 0 };
      sensorStatsRef.current = { sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0, total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0, sumSwingSpeed: 0, maxSwingSpeed: 0, lateralCount: 0, forwardBackCount: 0, verticalCount: 0, intensities: [], lastSec: 0, swingIntervals: [], lastSwingTime: 0, lastDominantAxis: null, directionChanges: 0 };
      rallySegRef.current = { rallyStart: 0, idleSince: 0, closed: true, count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0, lastDominantAxis: null };
      matchIdRef.current = "";
      rallyCountRef.current = 0;
      setMotionData(null);
      setIsSaving(false);
    } else {
      // Start tracking
      motionStatsRef.current = { count: 0, sumMagnitude: 0, maxMagnitude: 0, idle: 0, walking: 0, running: 0, smash_sprint: 0 };
      sensorStatsRef.current = { sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0, total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0, sumSwingSpeed: 0, maxSwingSpeed: 0, lateralCount: 0, forwardBackCount: 0, verticalCount: 0, intensities: [], lastSec: 0, swingIntervals: [], lastSwingTime: 0, lastDominantAxis: null, directionChanges: 0 };
      rallySegRef.current = { rallyStart: 0, idleSince: 0, closed: true, count: 0, sumMagnitude: 0, maxMagnitude: 0, smashCount: 0, directionChanges: 0, lastDominantAxis: null };
      matchIdRef.current = crypto.randomUUID();
      rallyCountRef.current = 0;
      setIsTracking(true);
      toast.success("Practice tracking started. Put phone in pocket.");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <ActivitySquare className="w-4 h-4 text-sky-400" />
            Practice Session Tracker
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            {isTracking 
              ? "Tracking active. Keep the app open or in background while playing." 
              : "Track your own motion during friendly matches or practice sessions."}
          </p>
        </div>
        <button 
          onClick={handleToggle}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            isTracking 
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
              : "bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30"
          }`}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isTracking ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />)}
          {isSaving ? "Saving..." : (isTracking ? "Stop & Save" : "Start Tracking")}
        </button>
      </div>
      
      {isTracking && motionData && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Current Intensity</span>
              <span className={`text-lg font-black ${
                motionData.intensity === "smash_sprint" ? "text-rose-500" :
                motionData.intensity === "running" ? "text-amber-500" :
                motionData.intensity === "walking" ? "text-blue-400" : "text-slate-400"
              }`}>
                {motionData.intensity.replace("_", " ")}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Magnitude</span>
              <span className="text-lg font-black text-slate-100">{motionData.magnitude.toFixed(1)}</span>
            </div>
          </div>
          
          <button
            onClick={() => setIsLocked(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm font-bold text-slate-300 transition-colors"
          >
            <Lock className="w-4 h-4" />
            Lock Screen (Pocket Mode)
          </button>
        </div>
      )}

      {isLocked && <ScreenLockOverlay onUnlock={() => setIsLocked(false)} />}
    </div>
  );
}
