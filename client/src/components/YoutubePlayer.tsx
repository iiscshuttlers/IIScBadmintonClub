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

interface Props {
  videoId: string;
  title?: string;
  chapters?: Chapter[];
  className?: string;
  onTimeUpdate?: (t: number) => void;
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
    { videoId, chapters = [], className, onTimeUpdate },
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
    }, []);

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

    // ── Auto-hide controls ───────────────────────────────────────────────────────
    const revealControls = useCallback(() => {
      setShowControls(true);
      clearTimeout(hideTimer.current);
      if (playing) {
        hideTimer.current = setTimeout(() => setShowControls(false), 3000);
      }
    }, [playing]);

    // ── Chapter helpers ──────────────────────────────────────────────────────────
    const currentChapter =
      chapters.length > 0
        ? [...chapters].reverse().find((c) => currentTime >= c.time)
        : null;

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
        <div id={divId.current} className="w-full h-full pointer-events-none" />

        {/* Loading spinner */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Click overlay — play/pause on single click, fullscreen on double */}
        <div
          className="absolute inset-0 z-20 cursor-pointer"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

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
          className={`absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

          <div className="relative px-3 pb-3 pt-8">
            {/* Chapter label */}
            {currentChapter && (
              <p className="text-white/60 text-xs mb-1.5 ml-0.5 truncate font-medium tracking-wide">
                {currentChapter.title}
              </p>
            )}

            {/* Progress bar */}
            <div
              className="relative h-1 mb-3 cursor-pointer group/bar"
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
            <div className="flex items-center gap-1">
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

              {/* Skip +10 */}
              <button
                onClick={() => skip(10)}
                className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-0.5"
                aria-label="Forward 10 seconds"
              >
                <span className="text-[10px] font-bold leading-none">10</span>
                <SkipForward className="w-4 h-4" />
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
