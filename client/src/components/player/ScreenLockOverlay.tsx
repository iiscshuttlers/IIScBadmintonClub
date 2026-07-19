import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";

export function ScreenLockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const [progress, setProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    // Request WakeLock to keep screen on while in pocket mode
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.error("WakeLock failed:", err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
      }
    };
  }, []);

  const handlePointerDown = () => {
    setProgress(0);
    const startTime = Date.now();
    const duration = 1500; // 1.5 seconds to unlock

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      if (newProgress >= 100) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        onUnlock();
      }
    }, 50);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
    setProgress(0);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center touch-none">
      <div className="text-slate-400 text-sm mb-12 animate-pulse">
        Screen Locked for Pocket Mode
      </div>
      
      <div 
        className="relative w-32 h-32 flex items-center justify-center rounded-full border-4 border-slate-800 bg-slate-900 select-none cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Lock className="w-10 h-10 text-slate-500 z-10" />
        
        {/* Progress ring overlay */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
          <circle
            cx="60"
            cy="60"
            r="56"
            fill="transparent"
            stroke="rgba(14, 165, 233, 0.5)"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 56}
            strokeDashoffset={2 * Math.PI * 56 * (1 - progress / 100)}
            className="transition-all duration-75 ease-linear"
          />
        </svg>
      </div>
      
      <div className="text-slate-500 text-xs mt-6 font-bold uppercase tracking-widest">
        Hold to Unlock
      </div>
    </div>
  );
}
