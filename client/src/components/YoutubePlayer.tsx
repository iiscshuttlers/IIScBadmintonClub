import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  Youtube,
  HelpCircle,
  X,
  Sparkles,
} from "lucide-react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type Chapter = { time: number; title: string };

export interface YoutubePlayerHandle {
  seekTo: (seconds: number) => void;
}

export interface ScoreLog {
  time: number;
  teamA: number;
  teamB: number;
  serverIdx?: number; // 0 or 1 for Team A, 2 or 3 for Team B
}

interface Props {
  videoId: string;
  title?: string;
  chapters?: Chapter[];
  className?: string;
  onTimeUpdate?: (t: number) => void;
  onCloseRequest?: () => void;
  scoreLogs?: ScoreLog[];
  teamA?: string[];
  teamB?: string[];
  enableScoringMode?: boolean;
  onScoreLogsChange?: (logs: ScoreLog[]) => void;
}

// ── Global YT API loader (singleton) ──────────────────────────────────────────
let ytApiLoaded = false;
let ytApiReady = false;
const ytCallbacks: Array<() => void> = [];

function loadYTApi(cb: () => void) {
  if (ytApiReady) {
    cb();
    return;
  }
  ytCallbacks.push(cb);
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytCallbacks.forEach((f) => f());
    ytCallbacks.length = 0;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ── Component ─────────────────────────────────────────────────────────────────
export const YoutubePlayer = forwardRef<YoutubePlayerHandle, Props>(
  function YoutubePlayer(
    { videoId, chapters = [], className, onTimeUpdate, onCloseRequest, scoreLogs = [], teamA = ["Team A"], teamB = ["Team B"], enableScoringMode = false, onScoreLogsChange },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const divId = useRef(
      `yt-${videoId}-${Math.random().toString(36).slice(2)}`,
    );
    const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const isSeeking = useRef(false);

    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [muted, setMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSpeed, setShowSpeed] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [slowMoUntil, setSlowMoUntil] = useState<number | null>(null);
    const prevSpeed = useRef<number>(1);

    // ── Gestures ─────────────────────────────────────────────────────────────────
    const [brightness, setBrightness] = useState(1);
    const [showGestureHint, setShowGestureHint] = useState<{ text: string } | null>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number; angle?: number; speed?: number; dist?: number; startScale?: number } | null>(null);
    const lastTapRef = useRef<{ time: number; x: number } | null>(null);
    const lastTwoFingerTapRef = useRef<number | null>(null);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHoldingRef = useRef(false);
    const preventClickRef = useRef(false);
    const initialVolRef = useRef<number>(100);
    const initialBrightRef = useRef<number>(1);
    const holdPrevSpeedRef = useRef<number>(1);

    const [zoomParams, setZoomParams] = useState({ scale: 1, x: 0, y: 0 });
    const [scrubDelta, setScrubDelta] = useState<number | null>(null);
    const [abLoop, setAbLoop] = useState<{ start: number; end: number } | null>(null);
    const [isDrawMode, setIsDrawMode] = useState(false);
    const [drawLines, setDrawLines] = useState<{ x: number; y: number }[][]>([]);
    const [currentLine, setCurrentLine] = useState<{ x: number; y: number }[]>([]);
    const [showHelp, setShowHelp] = useState(false);
    const [autoHighlightsMode, setAutoHighlightsMode] = useState(false);

    const STORAGE_KEY = `yt_pos_${videoId}`;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (!playerRef.current) return;
        playerRef.current.seekTo(seconds, true);
        setCurrentTime(seconds);
      },
    }));

    // ── Create player ────────────────────────────────────────────────────────────
    useEffect(() => {
      loadYTApi(() => {
        playerRef.current = new window.YT.Player(divId.current, {
          videoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            playsinline: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: (e: any) => {
              setReady(true);
              const d = e.target.getDuration();
              setDuration(d);
              const saved = parseFloat(
                localStorage.getItem(STORAGE_KEY) || "0",
              );
              if (saved > 5 && saved < d - 5) e.target.seekTo(saved, true);
            },
            onStateChange: (e: any) => {
              const isPlaying = e.data === window.YT.PlayerState.PLAYING;
              setPlaying(isPlaying);
              if (isPlaying) {
                setDuration(e.target.getDuration());
                clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => {
                  const t = e.target.getCurrentTime();
                  setCurrentTime(t);
                  onTimeUpdate?.(t);
                  localStorage.setItem(STORAGE_KEY, String(Math.floor(t)));
                }, 250);
              } else {
                clearInterval(intervalRef.current);
              }
            },
          },
        });
      });
      return () => {
        clearInterval(intervalRef.current);
        clearTimeout(hideTimer.current);
        playerRef.current?.destroy();
      };
    }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fullscreen change ────────────────────────────────────────────────────────
    useEffect(() => {
      const handler = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", handler);
      return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    // ── Keyboard shortcuts ───────────────────────────────────────────────────────
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        if (!playerRef.current || !ready) return;
        switch (e.key) {
          case " ":
          case "k":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowRight":
            e.preventDefault();
            skip(10);
            break;
          case "ArrowLeft":
            e.preventDefault();
            skip(-10);
            break;
          case "f":
          case "F":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "m":
          case "M":
            e.preventDefault();
            toggleMute();
            break;
          case ",":
            e.preventDefault();
            skip(-0.1);
            break;
          case ".":
            e.preventDefault();
            skip(0.1);
            break;
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [ready, playing]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Actions ──────────────────────────────────────────────────────────────────
    const togglePlay = useCallback(() => {
      if (!playerRef.current) return;
      playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
    }, [playing]);

    const skip = useCallback(
      (secs: number) => {
        if (!playerRef.current) return;
        const next = Math.max(
          0,
          Math.min(playerRef.current.getCurrentTime() + secs, duration),
        );
        playerRef.current.seekTo(next, true);
        setCurrentTime(next);
      },
      [duration],
    );

    const seekTo = useCallback(
      (pct: number) => {
        if (!playerRef.current || !duration) return;
        const t = pct * duration;
        playerRef.current.seekTo(t, true);
        setCurrentTime(t);
      },
      [duration],
    );

    const setPlaybackRate = useCallback((s: number) => {
      playerRef.current?.setPlaybackRate(s);
      setSpeed(s);
      setShowSpeed(false);
      setSlowMoUntil(null);
      prevSpeed.current = s;
    }, []);

    const triggerSlowMoReplay = useCallback(() => {
      if (!playerRef.current) return;
      const t = playerRef.current.getCurrentTime();
      const target = Math.max(0, t - 5);
      
      if (slowMoUntil === null) {
        prevSpeed.current = speed;
      }
      
      playerRef.current.seekTo(target, true);
      playerRef.current.setPlaybackRate(0.5);
      setSpeed(0.5);
      setSlowMoUntil(t);
      if (!playing) {
        playerRef.current.playVideo();
      }
    }, [speed, slowMoUntil, playing]);

    // Auto-revert slow-mo after passing the original time
    useEffect(() => {
      if (slowMoUntil !== null && currentTime >= slowMoUntil) {
        playerRef.current?.setPlaybackRate(prevSpeed.current);
        setSpeed(prevSpeed.current);
        setSlowMoUntil(null);
      }
      if (abLoop && currentTime >= abLoop.end) {
        playerRef.current?.seekTo(abLoop.start, true);
      }
    }, [currentTime, slowMoUntil, abLoop]);

    const toggleMute = useCallback(() => {
      if (!playerRef.current) return;
      if (muted) {
        playerRef.current.unMute();
        setMuted(false);
      } else {
        playerRef.current.mute();
        setMuted(true);
      }
    }, [muted]);

    const toggleFullscreen = useCallback(() => {
      if (!containerRef.current) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else containerRef.current.requestFullscreen?.();
    }, []);

    // ── Gestures Logic ───────────────────────────────────────────────────────────
    const showHint = useCallback((text: string) => {
      setShowGestureHint({ text });
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setShowGestureHint(null), 1000);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
      const now = Date.now();
      preventClickRef.current = false;

      if (e.touches.length === 1) {
        if (isDrawMode) {
           const touch = e.touches[0];
           const rect = e.currentTarget.getBoundingClientRect();
           const x = touch.clientX - rect.left;
           const y = touch.clientY - rect.top;
           setCurrentLine([{x, y}]);
           preventClickRef.current = true;
           return;
        }

        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;

        if (lastTapRef.current && now - lastTapRef.current.time < 300) {
          if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
          
          const { width } = e.currentTarget.getBoundingClientRect();
          
          if (x > width * 0.35 && x < width * 0.65) {
            toggleFullscreen();
            showHint("🔲 Fullscreen");
          } else if (x < width / 2) {
            skip(-10);
            showHint("⏪ 10s");
          } else {
            skip(10);
            showHint("10s ⏩");
          }
          
          lastTapRef.current = null;
          preventClickRef.current = true;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          return;
        }
        
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
        touchStartRef.current = { x: 0, y: 0, time: now, angle, speed: speed, dist, startScale: zoomParams.scale };
      } else if (e.touches.length === 3) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        preventClickRef.current = true;
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: now };
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

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

        const dt = Date.now() - touchStartRef.current.time;
        if (dy > 100 && Math.abs(dx) < 40 && dt < 300) {
           if (onCloseRequest) {
              onCloseRequest();
              touchStartRef.current.y = e.touches[0].clientY;
           }
           return;
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

        const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
        if (isHorizontal) {
           const seconds = Math.round(dx / 5);
           setScrubDelta(seconds);
           showHint(seconds > 0 ? `+${seconds}s ⏩` : `${seconds}s ⏪`);
           preventClickRef.current = true;
           return;
        }

        if (dx < -80 && dy > 80) {
           const link = `https://youtube.com/watch?v=${videoId}&t=${Math.floor(currentTime)}`;
           navigator.clipboard.writeText(link).catch(() => {});
           showHint("Timestamp Link Copied! 🔗");
           if (navigator.share) navigator.share({ url: link }).catch(() => {});
           touchStartRef.current.x = -9999; 
           return;
        }
        
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20) {
          const { width, height } = e.currentTarget.getBoundingClientRect();
          const isLeft = touchStartRef.current.x < width / 2;
          const delta = -dy / height; 
          
          if (isLeft) {
            const newB = Math.max(0.2, Math.min(2, initialBrightRef.current + delta * 2));
            setBrightness(newB);
            showHint(`☀️ ${Math.round(newB * 100)}%`);
          } else {
            if (playerRef.current) {
              try {
                const newV = Math.max(0, Math.min(100, initialVolRef.current + delta * 100));
                playerRef.current.setVolume(newV);
                if (newV > 0 && muted) {
                  playerRef.current.unMute();
                  setMuted(false);
                }
                showHint(`🔊 ${Math.round(newV)}%`);
              } catch {}
            }
          }
        }
      }
    };

    const handleTouchEnd = () => {
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
        setSpeed(holdPrevSpeedRef.current);
        setShowGestureHint(null);
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      if (preventClickRef.current) {
        preventClickRef.current = false;
        return;
      }

      const { width } = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      
      // 6. Extreme Edge Taps (Chapter Skipping)
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
    };

    // ── Auto-hide controls ───────────────────────────────────────────────────────
    const revealControls = useCallback(() => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      if (playing) {
        hideTimer.current = setTimeout(() => setShowControls(false), 3000);
      }
    }, [playing]);

    // ── Chapter & Score helpers ──────────────────────────────────────────────────────────
    const currentChapter =
      chapters.length > 0
        ? [...chapters].reverse().find((c) => currentTime >= c.time)
        : null;

    const currentScore = (() => {
       if (!scoreLogs || scoreLogs.length === 0) return null;
       const pastLogs = scoreLogs.filter(log => currentTime >= log.time);
       if (pastLogs.length === 0) return { teamA: 0, teamB: 0 };
       return pastLogs[pastLogs.length - 1];
    })();

    // ── Auto Highlights Engine ───────────────────────────────────────────────────
    const highlightRanges = React.useMemo(() => {
      if (!scoreLogs || scoreLogs.length === 0) return [];
      // Create a 15-second highlight window for each point (12s before, 3s after)
      const ranges = scoreLogs.map(log => ({ start: Math.max(0, log.time - 12), end: log.time + 3 }));
      // Merge overlapping ranges
      const merged: { start: number; end: number }[] = [];
      ranges.forEach(r => {
        if (merged.length === 0) { merged.push({ ...r }); return; }
        const last = merged[merged.length - 1];
        if (r.start <= last.end + 5) { // If within 5 seconds, merge them
           last.end = Math.max(last.end, r.end);
        } else {
           merged.push({ ...r });
        }
      });
      return merged;
    }, [scoreLogs]);

    React.useEffect(() => {
      if (!autoHighlightsMode || highlightRanges.length === 0 || !playerRef.current) return;
      const currentIdx = highlightRanges.findIndex(r => currentTime >= r.start && currentTime <= r.end);
      if (currentIdx === -1) {
        // We are outside a highlight range. Find the NEXT range.
        const nextRange = highlightRanges.find(r => r.start > currentTime);
        if (nextRange) {
          seekTo(nextRange.start);
          showHint("Skipping to next highlight ⏭️");
        } else {
          // No more highlights
          setAutoHighlightsMode(false);
          playerRef.current.pauseVideo();
          setPlaying(false);
          showHint("End of highlights");
        }
      }
    }, [currentTime, autoHighlightsMode, highlightRanges]);

    const handleAddPoint = (team: 'A' | 'B', playerIdx?: number) => {
       if (!onScoreLogsChange) return;
       const lastLog = scoreLogs.length > 0 ? scoreLogs[scoreLogs.length - 1] : { teamA: 0, teamB: 0 };
       const newLog = {
         time: Math.floor(currentTime),
         teamA: team === 'A' ? lastLog.teamA + 1 : lastLog.teamA,
         teamB: team === 'B' ? lastLog.teamB + 1 : lastLog.teamB,
         serverIdx: playerIdx !== undefined ? playerIdx : lastLog.serverIdx,
       };
       onScoreLogsChange([...scoreLogs, newLog].sort((a, b) => a.time - b.time));
       showHint(`${team === 'A' ? teamA[0] : teamB[0]} scored!`);
    };

    const handleSetServer = (serverIdx: number) => {
       if (!onScoreLogsChange) return;
       const lastLog = scoreLogs.length > 0 ? scoreLogs[scoreLogs.length - 1] : { teamA: 0, teamB: 0 };
       const newLog = { ...lastLog, time: Math.floor(currentTime), serverIdx };
       // remove log at same time if exists
       const filtered = scoreLogs.filter(l => l.time !== newLog.time);
       onScoreLogsChange([...filtered, newLog].sort((a, b) => a.time - b.time));
       showHint("Server updated!");
    };

    const handleUndoScore = () => {
       if (!onScoreLogsChange || scoreLogs.length === 0) return;
       onScoreLogsChange(scoreLogs.slice(0, -1));
       showHint("Undo Score");
    };

    const progress = duration > 0 ? currentTime / duration : 0;

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
      <div
        ref={containerRef}
        className={`relative bg-black overflow-hidden select-none group/player ${className ?? ""}`}
        onMouseMove={revealControls}
        onMouseLeave={() => playing && setShowControls(false)}
        onTouchStart={revealControls}
      >
        {/* YouTube iframe target */}
        <div 
          id={divId.current} 
          className="w-full h-full transform-gpu transition-transform duration-75" 
          style={{ 
             filter: `brightness(${brightness})`,
             transform: `scale(${zoomParams.scale}) translate(${zoomParams.x}px, ${zoomParams.y}px)`
          }} 
        />

        {/* Dynamic Scoreboard Overlay (BWF Style) */}
        {(currentScore || enableScoringMode) && (
          <div className="absolute top-8 left-8 z-30 flex flex-col bg-[#1A1A1A]/95 border border-white/10 rounded shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto select-none min-w-[240px] md:min-w-[280px]">
            {/* Team A Row */}
            <div className="flex items-stretch border-b border-white/10 h-10 md:h-12">
              <div className="w-6 flex items-center justify-center bg-black/40 shrink-0">
                 {/* Server Indicator */}
                 {(currentScore?.serverIdx === 0 || currentScore?.serverIdx === 1) && (
                   <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#E5FA00]" />
                 )}
              </div>
              <div className="flex-1 flex flex-col justify-center px-3 py-1 bg-gradient-to-r from-black/20 to-transparent">
                 <div className="flex flex-col text-[10px] md:text-xs leading-[1.2] font-black text-white uppercase tracking-wider font-sans">
                   {teamA.length === 2 ? (
                     <>
                       <span onClick={() => handleSetServer(0)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 0 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamA[0]}</span>
                       <span onClick={() => handleSetServer(1)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 1 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamA[1]}</span>
                     </>
                   ) : (
                     <span onClick={() => handleSetServer(0)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 0 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamA[0]}</span>
                   )}
                 </div>
              </div>
              <div className="w-12 md:w-14 flex items-center justify-center bg-black/60 border-l border-white/10 shrink-0">
                 <span className={`font-black text-xl md:text-2xl ${currentScore && currentScore.teamA > (currentScore.teamB || 0) ? 'text-white' : 'text-white/80'}`}>{currentScore?.teamA || 0}</span>
              </div>
            </div>
            {/* Team B Row */}
            <div className="flex items-stretch h-10 md:h-12">
              <div className="w-6 flex items-center justify-center bg-black/40 shrink-0">
                 {(currentScore?.serverIdx === 2 || currentScore?.serverIdx === 3) && (
                   <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#E5FA00]" />
                 )}
              </div>
              <div className="flex-1 flex flex-col justify-center px-3 py-1 bg-gradient-to-r from-black/20 to-transparent">
                 <div className="flex flex-col text-[10px] md:text-xs leading-[1.2] font-black text-white uppercase tracking-wider font-sans">
                   {teamB.length === 2 ? (
                     <>
                       <span onClick={() => handleSetServer(2)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 2 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamB[0]}</span>
                       <span onClick={() => handleSetServer(3)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 3 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamB[1]}</span>
                     </>
                   ) : (
                     <span onClick={() => handleSetServer(2)} className={`cursor-pointer transition-colors ${currentScore?.serverIdx === 2 ? 'text-[#E5FA00]' : 'text-white/90 hover:text-white'}`}>{teamB[0]}</span>
                   )}
                 </div>
              </div>
              <div className="w-12 md:w-14 flex items-center justify-center bg-black/60 border-l border-white/10 shrink-0">
                 <span className={`font-black text-xl md:text-2xl ${currentScore && currentScore.teamB > (currentScore.teamA || 0) ? 'text-white' : 'text-white/80'}`}>{currentScore?.teamB || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Scoring Mode Controls */}
        {enableScoringMode && (
           <div className="absolute top-20 left-4 z-40 flex flex-col gap-2">
             <div className="flex flex-col gap-1 bg-slate-800/80 backdrop-blur-sm border border-white/10 p-2 rounded-xl">
               <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest pl-1 mb-1">Score Team A</span>
               {teamA.map((name, i) => (
                 <button key={i} onClick={(e) => { e.stopPropagation(); handleAddPoint('A', i); }} className="bg-white/5 hover:bg-white/10 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg transition-colors flex items-center justify-between gap-3 text-left">
                   <span>+1 {name}</span> <span className="opacity-50 text-[10px]">Tap</span>
                 </button>
               ))}
             </div>
             <div className="flex flex-col gap-1 bg-emerald-900/80 backdrop-blur-sm border border-emerald-500/30 p-2 rounded-xl mt-1">
               <span className="text-[10px] text-emerald-400/50 font-bold uppercase tracking-widest pl-1 mb-1">Score Team B</span>
               {teamB.map((name, i) => (
                 <button key={i} onClick={(e) => { e.stopPropagation(); handleAddPoint('B', i + 2); }} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg transition-colors flex items-center justify-between gap-3 text-left">
                   <span>+1 {name}</span> <span className="opacity-50 text-[10px]">Tap</span>
                 </button>
               ))}
             </div>
             <button onClick={(e) => { e.stopPropagation(); handleUndoScore(); }} disabled={scoreLogs.length === 0} className="bg-white/5 hover:bg-white/10 disabled:opacity-30 backdrop-blur-sm text-white/80 font-bold text-xs px-3 py-1.5 rounded-xl shadow-lg transition-colors mt-2">
               Undo Last Score
             </button>
             <button onClick={(e) => { 
                e.stopPropagation(); 
                navigator.clipboard.writeText(JSON.stringify(scoreLogs, null, 2));
                showHint("Score JSON Copied!");
             }} className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold text-xs px-3 py-1.5 rounded-xl shadow-lg transition-colors border border-rose-500/30 mt-4">
               Copy JSON Data
             </button>
           </div>
        )}

        {/* Loading spinner */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Draw Mode Overlay */}
        {isDrawMode && (
           <div className="absolute inset-0 z-40 bg-black/10">
             <svg className="w-full h-full pointer-events-none">
               {drawLines.map((line, i) => (
                  <polyline key={i} points={line.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
               ))}
               {currentLine.length > 0 && (
                  <polyline points={currentLine.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
               )}
             </svg>
             <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full shadow-xl pointer-events-auto">
                <span className="text-white font-bold text-sm mr-2 tracking-wide">DRAW MODE</span>
                <button onClick={(e) => { e.stopPropagation(); setDrawLines([]); setCurrentLine([]); }} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Clear</button>
                <button onClick={(e) => { e.stopPropagation(); setIsDrawMode(false); setDrawLines([]); setCurrentLine([]); }} className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Exit</button>
             </div>
           </div>
        )}

        {/* Help Overlay */}
        {showHelp && (
          <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-white overflow-y-auto">
            <div className="w-full max-w-lg bg-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl border border-white/10">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold flex items-center gap-2"><HelpCircle className="w-6 h-6 text-emerald-400" /> Gesture Cheat Sheet</h2>
                 <button onClick={() => setShowHelp(false)} className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                 <div className="bg-white/5 p-4 rounded-xl">
                   <h3 className="font-bold text-emerald-400 mb-1">One-Finger Swipes</h3>
                   <ul className="space-y-1.5 text-white/80 list-disc list-inside">
                     <li><strong className="text-white">Left Edge (Up/Down):</strong> Brightness</li>
                     <li><strong className="text-white">Right Edge (Up/Down):</strong> Volume</li>
                     <li><strong className="text-white">Center (Left/Right):</strong> Precision Scrubbing</li>
                     <li><strong className="text-white">Diagonal:</strong> Copy Timestamp Link</li>
                     <li><strong className="text-white">From Top Edge (Down):</strong> Close Player</li>
                   </ul>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl">
                   <h3 className="font-bold text-cyan-400 mb-1">Multi-Touch & Taps</h3>
                   <ul className="space-y-1.5 text-white/80 list-disc list-inside">
                     <li><strong className="text-white">Two-Finger Pinch:</strong> Zoom & Pan</li>
                     <li><strong className="text-white">Two-Finger Rotate:</strong> Change Speed</li>
                     <li><strong className="text-white">Two-Finger Double Tap:</strong> A-B Loop (10s)</li>
                     <li><strong className="text-white">Two-Finger Hold (0.5s):</strong> Telestrator Draw Mode</li>
                     <li><strong className="text-white">Three-Finger Swipe Down:</strong> Boss Mode (Mute + Dark)</li>
                     <li><strong className="text-white">Double Tap Sides:</strong> Skip ±10s</li>
                     <li><strong className="text-white">Double Tap Center:</strong> Fullscreen</li>
                   </ul>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* Help Overlay */}
        {showHelp && (
          <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-white overflow-y-auto">
            <div className="w-full max-w-lg bg-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl border border-white/10">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold flex items-center gap-2"><HelpCircle className="w-6 h-6 text-emerald-400" /> Gesture Cheat Sheet</h2>
                 <button onClick={(e) => { e.stopPropagation(); setShowHelp(false); }} className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                 <div className="bg-white/5 p-4 rounded-xl">
                   <h3 className="font-bold text-emerald-400 mb-1">One-Finger Swipes</h3>
                   <ul className="space-y-1.5 text-white/80 list-disc list-inside">
                     <li><strong className="text-white">Left Edge (Up/Down):</strong> Brightness</li>
                     <li><strong className="text-white">Right Edge (Up/Down):</strong> Volume</li>
                     <li><strong className="text-white">Center (Left/Right):</strong> Precision Scrubbing</li>
                     <li><strong className="text-white">Diagonal:</strong> Copy Timestamp Link</li>
                     <li><strong className="text-white">From Top Edge (Down):</strong> Close Player</li>
                   </ul>
                 </div>
                 <div className="bg-white/5 p-4 rounded-xl">
                   <h3 className="font-bold text-cyan-400 mb-1">Multi-Touch & Taps</h3>
                   <ul className="space-y-1.5 text-white/80 list-disc list-inside">
                     <li><strong className="text-white">Two-Finger Pinch:</strong> Zoom & Pan</li>
                     <li><strong className="text-white">Two-Finger Rotate:</strong> Change Speed</li>
                     <li><strong className="text-white">Two-Finger Double Tap:</strong> A-B Loop (10s)</li>
                     <li><strong className="text-white">Two-Finger Hold (0.5s):</strong> Telestrator Draw Mode</li>
                     <li><strong className="text-white">Three-Finger Swipe Down:</strong> Boss Mode (Mute + Dark)</li>
                     <li><strong className="text-white">Double Tap Sides:</strong> Skip ±10s</li>
                     <li><strong className="text-white">Double Tap Center:</strong> Fullscreen</li>
                   </ul>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* Gesture overlay */}
        <div
          className="absolute inset-x-0 top-0 bottom-[25%] z-20 cursor-pointer"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          onDoubleClick={(e) => {
            const { width } = e.currentTarget.getBoundingClientRect();
            if (e.clientX < width / 2) {
              skip(-10);
              showHint("⏪ 10s");
            } else {
              skip(10);
              showHint("10s ⏩");
            }
            preventClickRef.current = true;
          }}
        />

        {/* Gesture Hint overlay */}
        {showGestureHint && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-200">
            <div className="bg-black/60 backdrop-blur-md text-white font-bold px-6 py-3 rounded-full text-lg shadow-2xl flex items-center gap-2">
              {showGestureHint.text}
            </div>
          </div>
        )}

        {/* Click overlay removed to allow interaction with native YouTube elements */}

        {/* Big play button in center when paused */}
        {ready && !playing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-9 h-9 text-white" fill="white" />
            </div>
          </div>
        )}

        {/* Controls gradient overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300 pointer-events-none ${showControls || !playing ? "opacity-100" : "opacity-0"}`}
        >
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

          <div className="relative px-4 pb-12 pt-12 md:pb-14 pointer-events-none">
            {/* Chapter label */}
            {currentChapter && (
              <p className="text-white/60 text-xs mb-1.5 ml-0.5 truncate font-medium tracking-wide">
                {currentChapter.title}
              </p>
            )}

            {/* Progress bar */}
            <div
              className={`relative h-1 mb-3 cursor-pointer group/bar ${showControls || !playing ? "pointer-events-auto" : ""}`}
              onMouseDown={(e) => {
                isSeeking.current = true;
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }}
              onMouseMove={(e) => {
                if (!isSeeking.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(
                  Math.max(
                    0,
                    Math.min(1, (e.clientX - rect.left) / rect.width),
                  ),
                );
              }}
              onMouseUp={() => {
                isSeeking.current = false;
              }}
              onMouseLeave={() => {
                isSeeking.current = false;
              }}
            >
              {/* Track */}
              <div className="absolute inset-0 bg-white/20 rounded-full" />
              {/* Played */}
              <div
                className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
              {/* Chapter ticks */}
              {duration > 0 &&
                chapters.map((ch) => (
                  <div
                    key={ch.time}
                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/70 rounded-full"
                    style={{ left: `${(ch.time / duration) * 100}%` }}
                    title={ch.title}
                  />
                ))}
              {/* Scrubber dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow -ml-1.5 scale-0 group-hover/bar:scale-100 transition-transform"
                style={{ left: `${progress * 100}%` }}
              />
            </div>

            {/* Controls row */}
            <div className={`flex items-center gap-1 ${showControls || !playing ? "pointer-events-auto" : ""}`}>
              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="text-white hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-white/10"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <Pause
                    className="w-5 h-5"
                    fill="currentColor"
                    stroke="none"
                  />
                ) : (
                  <Play className="w-5 h-5" fill="currentColor" stroke="none" />
                )}
              </button>

              {/* Skip −10 */}
              <button
                onClick={() => skip(-10)}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-0.5"
                aria-label="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[10px] font-bold leading-none">10</span>
              </button>

              {/* Watch Highlights */}
              {scoreLogs && scoreLogs.length > 0 && (
                 <button
                   onClick={() => { setAutoHighlightsMode(!autoHighlightsMode); showHint(autoHighlightsMode ? "Highlights Off" : "Highlights On"); }}
                   className={`text-[10px] md:text-xs font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm border ${autoHighlightsMode ? 'bg-amber-500 text-white border-amber-400' : 'bg-white/10 text-white hover:bg-white/20 border-white/20'}`}
                   title="Auto-Skip Dead Time"
                 >
                   <Sparkles className="w-3 h-3" /> Highlights
                 </button>
              )}

              {/* Skip +10 */}
              <button
                onClick={() => skip(10)}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-0.5"
                aria-label="Forward 10 seconds"
              >
                <span className="text-[10px] font-bold leading-none">10</span>
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Slow Mo Replay */}
              <button
                onClick={triggerSlowMoReplay}
                className="text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-emerald-500/10 flex items-center gap-1 mx-1 border border-emerald-500/20"
                title="5s Slow-Mo Replay"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold leading-none">5s</span>
                <span className="text-[10px] font-bold leading-none opacity-60">@0.5x</span>
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Time */}
              <span className="text-white/70 text-xs tabular-nums px-1 shrink-0">
                {fmt(currentTime)} / {fmt(duration)}
              </span>

              <div className="flex-1" />

              {/* Speed picker */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeed((v) => !v)}
                  className="text-white/80 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-bold flex items-center gap-1"
                  aria-label="Playback speed"
                >
                  <Gauge className="w-3.5 h-3.5" />
                  {speed}×
                </button>
                {showSpeed && (
                  <div className="absolute bottom-full right-0 mb-1 bg-gray-900/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaybackRate(s)}
                        className={`block w-full text-left px-5 py-1.5 text-sm hover:bg-white/10 transition-colors ${speed === s ? "text-emerald-400 font-bold" : "text-white"}`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Open in YouTube */}
              <a
                href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(currentTime)}s`}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (playing) togglePlay();
                }}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center justify-center"
                aria-label="Open in YouTube"
                title="Open in YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>

              {/* Help Button */}
              <button
                onClick={() => { setShowHelp(true); if (playing) togglePlay(); }}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                aria-label="Help / Gestures"
                title="Help / Gestures"
              >
                <HelpCircle className="w-4 h-4 text-sky-400" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
