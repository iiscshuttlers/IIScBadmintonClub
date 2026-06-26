import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useVideoGestures } from "@/hooks/useVideoGestures";
import { useYoutubeDrawing } from "./youtube/useYoutubeDrawing";
import { useYoutubeScoreTracking } from "./youtube/useYoutubeScoreTracking";

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
  serverIdx?: number;
}

// ── Global YT API loader (singleton) ──────────────────────────────────────────
let ytApiLoaded = false;
let ytApiReady = false;
const ytCallbacks: Array<() => void> = [];

export function loadYTApi(cb: () => void) {
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

export function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export interface UseYoutubePlayerProps {
  videoId: string;
  chapters?: Chapter[];
  onTimeUpdate?: (t: number) => void;
  scoreLogs?: ScoreLog[];
  teamA?: string[];
  teamB?: string[];
  onScoreLogsChange?: (logs: ScoreLog[]) => void;
}

export function useYoutubePlayer({
  videoId,
  chapters = [],
  onTimeUpdate,
  scoreLogs = [],
  teamA = ["Team A"],
  teamB = ["Team B"],
  onScoreLogsChange,
}: UseYoutubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const divId = useRef(`yt-${videoId}-${Math.random().toString(36).slice(2)}`);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slowMoUntil, setSlowMoUntil] = useState<number | null>(null);
  const prevSpeed = useRef<number>(1);
  const preventClickRef = useRef(false);

  const {
    zoomParams, setZoomParams,
    isDrawMode, setIsDrawMode,
    drawLines, setDrawLines,
    currentLine, setCurrentLine,
    brightness, setBrightness
  } = useYoutubeDrawing();

  const [showHelp, setShowHelp] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showClubControls, setShowClubControls] = useState(false);

  const STORAGE_KEY = `yt_pos_${videoId}`;

  const [showGestureHint, setShowGestureHint] = useState<{ text: string } | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrubDelta, setScrubDelta] = useState<number | null>(null);
  const [abLoop, setAbLoop] = useState<{ start: number; end: number } | null>(null);

  const showHint = useCallback((text: string) => {
    setShowGestureHint({ text });
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowGestureHint(null), 1000);
  }, []);

  useEffect(() => {
    loadYTApi(() => {
      playerRef.current = new window.YT.Player(divId.current, {
        videoId,
        playerVars: { controls: 0, disablekb: 1, rel: 0, modestbranding: 1, enablejsapi: 1, playsinline: 1, iv_load_policy: 3 },
        events: {
          onReady: (e: any) => {
            setReady(true);
            const d = e.target.getDuration();
            setDuration(d);
            const saved = parseFloat(localStorage.getItem(STORAGE_KEY) || "0");
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
  }, [videoId, onTimeUpdate]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
  }, [playing]);

  const skip = useCallback((secs: number) => {
    if (!playerRef.current) return;
    const next = Math.max(0, Math.min(playerRef.current.getCurrentTime() + secs, duration));
    playerRef.current.seekTo(next, true);
    setCurrentTime(next);
  }, [duration]);

  const seekTo = useCallback((pctOrSec: number, isPercent: boolean = true) => {
    if (!playerRef.current || !duration) return;
    const t = isPercent ? pctOrSec * duration : pctOrSec;
    playerRef.current.seekTo(t, true);
    setCurrentTime(t);
  }, [duration]);

  const setPlaybackRate = useCallback((s: number) => {
    playerRef.current?.setPlaybackRate(s);
    setSpeed(s);
    setShowClubControls(false);
    setSlowMoUntil(null);
    prevSpeed.current = s;
  }, []);

  const triggerSlowMoReplay = useCallback(() => {
    if (!playerRef.current) return;
    const t = playerRef.current.getCurrentTime();
    const target = Math.max(0, t - 5);
    if (slowMoUntil === null) prevSpeed.current = speed;
    playerRef.current.seekTo(target, true);
    playerRef.current.setPlaybackRate(0.5);
    setSpeed(0.5);
    setSlowMoUntil(t);
    if (!playing) playerRef.current.playVideo();
  }, [speed, slowMoUntil, playing]);

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
    if (muted) { playerRef.current.unMute(); setMuted(false); }
    else { playerRef.current.mute(); setMuted(true); }
  }, [muted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      try { if (screen.orientation && (screen.orientation as any).unlock) (screen.orientation as any).unlock(); } catch {}
    } else {
      containerRef.current.requestFullscreen?.().then(() => {
        try { if (screen.orientation && (screen.orientation as any).lock) (screen.orientation as any).lock("landscape").catch(() => {}); } catch {}
      });
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!playerRef.current || !ready) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowRight": e.preventDefault(); skip(10); break;
        case "ArrowLeft": e.preventDefault(); skip(-10); break;
        case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
        case "m": case "M": e.preventDefault(); toggleMute(); break;
        case ",": e.preventDefault(); skip(-0.1); break;
        case ".": e.preventDefault(); skip(0.1); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ready, playing, skip, toggleFullscreen, toggleMute, togglePlay]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, [playing]);

  const currentChapter = chapters.length > 0 ? [...chapters].reverse().find(c => currentTime >= c.time) : null;

  const {
    autoHighlightsMode, setAutoHighlightsMode,
    currentScore,
    handleAddPoint, handleSetServer, handleUndoScore
  } = useYoutubeScoreTracking({
    scoreLogs,
    onScoreLogsChange,
    currentTime,
    showHint,
    teamA,
    teamB,
    playerRef,
    seekTo,
    setPlaying
  });

  const gestures = useVideoGestures({
    isLocked, isDrawMode, setIsDrawMode, playing, muted, speed, duration, currentTime,
    chapters, brightness, abLoop, setAbLoop, toggleMute, setBrightness, showHint,
    setZoomParams, setPlaybackRate, setScrubDelta, setCurrentLine, currentLine,
    setDrawLines, skip, seekTo: (pct) => seekTo(pct, true), togglePlay, playerRef,
    setShowGestureHint, scrubDelta, zoomParams
  });

  return {
    containerRef, playerRef, divId, isSeeking, preventClickRef,
    ready, playing, currentTime, duration, speed, muted, showControls, setShowControls, isFullscreen,
    brightness, showGestureHint, setShowGestureHint, zoomParams, scrubDelta, abLoop,
    isDrawMode, setIsDrawMode, drawLines, setDrawLines, currentLine, setCurrentLine,
    showHelp, setShowHelp, autoHighlightsMode, setAutoHighlightsMode, isLocked, setIsLocked,
    showClubControls, setShowClubControls,
    togglePlay, skip, seekTo, setPlaybackRate, triggerSlowMoReplay, toggleMute, toggleFullscreen,
    revealControls, currentChapter, currentScore, handleAddPoint, handleSetServer, handleUndoScore,
    showHint, gestures, STORAGE_KEY
  };
}
