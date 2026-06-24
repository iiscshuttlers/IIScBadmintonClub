import { useRef, useCallback } from "react";

export interface GestureDependencies {
  isLocked: boolean;
  isDrawMode: boolean;
  setIsDrawMode: React.Dispatch<React.SetStateAction<boolean>>;
  playing: boolean;
  muted: boolean;
  speed: number;
  duration: number;
  currentTime: number;
  chapters: any[];
  brightness: number;
  abLoop: { start: number; end: number } | null;
  setAbLoop: React.Dispatch<React.SetStateAction<{ start: number; end: number } | null>>;
  toggleMute: () => void;
  setBrightness: (b: number) => void;
  showHint: (h: string) => void;
  setZoomParams: React.Dispatch<React.SetStateAction<{ scale: number; x: number; y: number }>>;
  setPlaybackRate: (r: number) => void;
  setScrubDelta: React.Dispatch<React.SetStateAction<number | null>>;
  setCurrentLine: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  currentLine: { x: number; y: number }[];
  setDrawLines: React.Dispatch<React.SetStateAction<{ x: number; y: number }[][]>>;
  skip: (s: number) => void;
  seekTo: (frac: number) => void;
  togglePlay: () => void;
  playerRef: React.MutableRefObject<any>;
  setShowGestureHint: any;
  scrubDelta: number | null;
  zoomParams: { scale: number; x: number; y: number };
}

export function useVideoGestures({
  isLocked,
  isDrawMode,
  setIsDrawMode,
  playing,
  muted,
  speed,
  duration,
  currentTime,
  chapters,
  brightness,
  abLoop,
  setAbLoop,
  toggleMute,
  setBrightness,
  showHint,
  setZoomParams,
  setPlaybackRate,
  setScrubDelta,
  setCurrentLine,
  currentLine,
  setDrawLines,
  skip,
  seekTo,
  togglePlay,
  playerRef,
  setShowGestureHint,
  scrubDelta,
  zoomParams
}: GestureDependencies) {
  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    dist?: number;
    angle?: number;
    startScale?: number;
    speed?: number;
  } | null>(null);
  
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const holdPrevSpeedRef = useRef<number>(1);
  const preventClickRef = useRef(false);
  
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const lastTwoFingerTapRef = useRef<number | null>(null);
  const initialVolRef = useRef<number | null>(null);
  const initialBrightRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isLocked) return;
    const now = Date.now();

    if (isDrawMode && e.touches.length === 1) {
       const touch = e.touches[0];
       const rect = e.currentTarget.getBoundingClientRect();
       const x = touch.clientX - rect.left;
       const y = touch.clientY - rect.top;
       setCurrentLine([{x, y}]);
       return;
    }

    if (e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const { width } = e.currentTarget.getBoundingClientRect();

      // Clear timers
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      preventClickRef.current = false;

      // Tap area checking for double tap
      if (lastTapRef.current && now - lastTapRef.current.time < 300) {
         preventClickRef.current = true;
         if (Math.abs(x - lastTapRef.current.x) < 50) {
            if (x < width * 0.3) {
              skip(-10);
              showHint("⏪ -10s");
            } else if (x > width * 0.7) {
              skip(10);
              showHint("+10s ⏩");
            }
         }
         lastTapRef.current = null;
         return;
      }

      // Fast-forward hold gesture
      holdTimerRef.current = setTimeout(() => {
         if (!preventClickRef.current && touchStartRef.current) {
            const dx = Math.abs(x - touchStartRef.current.x);
            const dy = Math.abs(y - touchStartRef.current.y);
            if (dx < 10 && dy < 10) {
               isHoldingRef.current = true;
               holdPrevSpeedRef.current = speed;
               playerRef.current?.setPlaybackRate(2);
               setPlaybackRate(2);
               setShowGestureHint("2x Speed ⏩");
               preventClickRef.current = true;
            }
         }
      }, 500);

      lastTapRef.current = { time: now, x };
      touchStartRef.current = { x, y, time: now };
      
      if (playerRef.current) {
         try { initialVolRef.current = playerRef.current.getVolume(); } catch {}
      }
      initialBrightRef.current = brightness;

    } else if (e.touches.length === 2) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      preventClickRef.current = true;
      
      if (lastTwoFingerTapRef.current && now - lastTwoFingerTapRef.current < 300) {
         if (abLoop) {
           setAbLoop(null);
           showHint("🔁 Loop Cleared");
         } else {
           const end = playerRef.current?.getCurrentTime() || 0;
           const start = Math.max(0, end - 10);
           setAbLoop({ start, end });
           showHint("🔁 A-B Loop Set (10s)");
         }
         lastTwoFingerTapRef.current = null;
         return;
      }
      lastTwoFingerTapRef.current = now;

      holdTimerRef.current = setTimeout(() => {
         setIsDrawMode(true);
         if (playing) togglePlay();
         showHint("🖌️ Draw Mode");
      }, 500);

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartRef.current = { x: 0, y: 0, time: now, angle, speed, dist, startScale: zoomParams.scale };
    } else if (e.touches.length === 3) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      preventClickRef.current = true;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: now };
    }
  }, [isLocked, isDrawMode, speed, playerRef, setPlaybackRate, showHint, setZoomParams, setCurrentLine, skip, abLoop, playing, setIsDrawMode, setAbLoop, togglePlay, zoomParams, setShowGestureHint, brightness]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isLocked || !touchStartRef.current) return;

    if (e.touches.length === 3) {
       const dy = e.touches[0].clientY - touchStartRef.current.y;
       if (dy > 80) {
          if (!muted) toggleMute();
          setBrightness(0.2);
          showHint("Boss Mode 🤫");
          touchStartRef.current.y = e.touches[0].clientY; 
       }
       return;
    }

    if (e.touches.length === 2 && touchStartRef.current.angle !== undefined && touchStartRef.current.speed !== undefined) {
       if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
       
       const t1 = e.touches[0];
       const t2 = e.touches[1];
       
       if (touchStartRef.current.dist !== undefined && touchStartRef.current.startScale !== undefined) {
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const scaleRatio = dist / Math.max(1, touchStartRef.current.dist);
          
          if (Math.abs(1 - scaleRatio) > 0.05) { 
             const newScale = Math.max(1, Math.min(4, touchStartRef.current.startScale * scaleRatio));
             setZoomParams(prev => ({ ...prev, scale: newScale }));
             if (newScale === 1) setZoomParams({ scale: 1, x: 0, y: 0 }); 
          }
       }
       
       const newAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
       let diff = newAngle - touchStartRef.current.angle;
       if (diff > Math.PI) diff -= Math.PI * 2;
       if (diff < -Math.PI) diff += Math.PI * 2;
       
       if (Math.abs(diff) > 0.1) {
         const deltaSpeed = diff / Math.PI; 
         const newSpeed = Math.max(0.25, Math.min(2, touchStartRef.current.speed + deltaSpeed));
         const roundedSpeed = Math.round(newSpeed * 4) / 4; 
         if (roundedSpeed !== speed) {
           setPlaybackRate(roundedSpeed);
           showHint(`Speed: ${roundedSpeed}x`);
         }
       }
       return;
    }

    if (e.touches.length === 1) {
      if (isDrawMode) {
         const touch = e.touches[0];
         const rect = e.currentTarget.getBoundingClientRect();
         const x = touch.clientX - rect.left;
         const y = touch.clientY - rect.top;
         setCurrentLine(prev => [...prev, {x, y}]);
         return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        preventClickRef.current = true;
      }

      if (zoomParams.scale > 1) {
         setZoomParams(prev => ({
           ...prev,
           x: prev.x + dx,
           y: prev.y + dy
         }));
         touchStartRef.current.x = touch.clientX;
         touchStartRef.current.y = touch.clientY;
         return;
      }

      const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40;
      if (isHorizontal) {
         const seconds = Math.round((dx < 0 ? dx + 40 : dx - 40) / 10);
         setScrubDelta(seconds);
         showHint(seconds > 0 ? `+${seconds}s ⏩` : `${seconds}s ⏪`);
         preventClickRef.current = true;
         return;
      }
    }
  }, [isLocked, muted, isDrawMode, speed, toggleMute, setBrightness, showHint, setZoomParams, setPlaybackRate, setCurrentLine, setScrubDelta, zoomParams]);

  const handleTouchEnd = useCallback(() => {
    if (isLocked) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    
    if (isDrawMode && currentLine.length > 0) {
       setDrawLines(prev => [...prev, currentLine]);
       setCurrentLine([]);
       return;
    }

    if (scrubDelta !== null) {
       skip(scrubDelta);
       setScrubDelta(null);
    }
    
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      playerRef.current?.setPlaybackRate(holdPrevSpeedRef.current);
      setPlaybackRate(holdPrevSpeedRef.current);
      setShowGestureHint(null);
    }
  }, [isLocked, isDrawMode, currentLine, skip, scrubDelta, playerRef, setPlaybackRate, setShowGestureHint, setDrawLines, setCurrentLine, setScrubDelta]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    if (preventClickRef.current) {
      preventClickRef.current = false;
      return;
    }

    const { width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    
    if (x < width * 0.05) {
       if (chapters && chapters.length > 0) {
          const prev = [...chapters].reverse().find(c => c.time < currentTime - 5);
          if (prev && duration > 0) { seekTo(prev.time / duration); showHint("⏮️ " + prev.title); return; }
       }
    } else if (x > width * 0.95) {
       if (chapters && chapters.length > 0) {
          const next = chapters.find(c => c.time > currentTime + 5);
          if (next && duration > 0) { seekTo(next.time / duration); showHint("⏭️ " + next.title); return; }
       }
    }

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      togglePlay();
      clickTimerRef.current = null;
    }, 250);
  }, [isLocked, chapters, currentTime, duration, seekTo, showHint, togglePlay]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
  };
}
