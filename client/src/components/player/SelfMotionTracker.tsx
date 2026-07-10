import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { ActivitySquare, Play, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PlayerMotion, type MotionData } from "@/lib/playerMotion";

export function SelfMotionTracker({ userId, onSaved }: { userId: string, onSaved?: () => void }) {
  const [isTracking, setIsTracking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    intensities: [] as number[], // downsampled for fatigue (e.g., 1 per second)
    lastSec: 0
  });

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
      
      if (data.swingDetected) {
        sens.total_swings += 1;
        if (data.swingType === "smash") sens.smash_count += 1;
        if (data.swingType === "clear") sens.clear_count += 1;
        if (data.swingType === "drive") sens.drive_count += 1;
        if (data.swingType === "net_shot") sens.net_shot_count += 1;
        
        const speed = data.rotationRate || data.magnitude;
        sens.sumSwingSpeed += speed;
        sens.maxSwingSpeed = Math.max(sens.maxSwingSpeed, speed);
      }
      
      // Dominant axis for movement (ignore idle)
      if (data.magnitude > 2.0) {
        const ax = Math.abs(data.x), ay = Math.abs(data.y), az = Math.abs(data.z);
        if (ax > ay && ax > az) sens.lateralCount += 1;
        else if (ay > ax && ay > az) sens.verticalCount += 1; // Assuming y is vertical if phone is in pocket upright
        else sens.forwardBackCount += 1; // z is forward/back
      }
      
      // Fatigue tracking (sample 1 per second)
      const now = Date.now();
      if (now - sens.lastSec > 1000) {
        sens.intensities.push(data.magnitude);
        sens.lastSec = now;
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
      if (stats.count > 10) {
        try {
          const matchId = `practice_${Date.now()}`;
          
          // 1. Save to old table
          await supabase.from("match_motion_stats").upsert({
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
          
          await supabase.from("match_sensor_analytics").upsert({
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
          });
          
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
      sensorStatsRef.current = { sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0, total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0, sumSwingSpeed: 0, maxSwingSpeed: 0, lateralCount: 0, forwardBackCount: 0, verticalCount: 0, intensities: [], lastSec: 0 };
      setMotionData(null);
      setIsSaving(false);
    } else {
      // Start tracking
      motionStatsRef.current = { count: 0, sumMagnitude: 0, maxMagnitude: 0, idle: 0, walking: 0, running: 0, smash_sprint: 0 };
      sensorStatsRef.current = { sumAccelSq: 0, sumGyro: 0, sumGyroSq: 0, maxGyro: 0, total_swings: 0, smash_count: 0, clear_count: 0, drive_count: 0, net_shot_count: 0, sumSwingSpeed: 0, maxSwingSpeed: 0, lateralCount: 0, forwardBackCount: 0, verticalCount: 0, intensities: [], lastSec: 0 };
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
        <div className="mt-4 flex items-center justify-between bg-slate-800 rounded-xl p-3 border border-slate-700">
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
      )}
    </div>
  );
}
