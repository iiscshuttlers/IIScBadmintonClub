import React from "react";
import {
  Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX, Maximize, Minimize,
  Settings, Lock, Smartphone, Youtube, HelpCircle, Sparkles
} from "lucide-react";
import { fmt, type useYoutubePlayer, type Chapter, type ScoreLog } from "@/hooks/useYoutubePlayer";

type PlayerContext = ReturnType<typeof useYoutubePlayer>;

interface PlayerControlsProps {
  player: PlayerContext;
  videoId: string;
  chapters: Chapter[];
  scoreLogs: ScoreLog[];
}

export function PlayerControls({ player, videoId, chapters, scoreLogs }: PlayerControlsProps) {
  const {
    isSeeking, playing, currentTime, duration, speed, muted, showControls, isFullscreen,
    autoHighlightsMode, setAutoHighlightsMode, isLocked, setIsLocked,
    showClubControls, setShowClubControls, setShowHelp,
    togglePlay, skip, seekTo, setPlaybackRate, triggerSlowMoReplay, toggleMute, toggleFullscreen,
    currentChapter, showHint
  } = player;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={`absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300 pointer-events-none ${showControls || !playing ? "opacity-100" : "opacity-0"} ${isLocked ? "hidden" : ""}`}>
      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      <div className="relative px-4 pb-12 pt-12 md:pb-14 pointer-events-none">
        {/* Chapter label */}
        {currentChapter && (
          <p className="text-foreground/60 text-xs mb-1.5 ml-0.5 truncate font-medium tracking-wide">
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
            seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
          }}
          onMouseUp={() => { isSeeking.current = false; }}
          onMouseLeave={() => { isSeeking.current = false; }}
        >
          {/* Track */}
          <div className="absolute inset-0 bg-white/20 rounded-full" />
          {/* Played */}
          <div className="absolute left-0 top-0 h-full bg-primary rounded-full" style={{ width: `${progress * 100}%` }} />
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
          <button onClick={togglePlay} className="text-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-white/10" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="w-5 h-5" fill="currentColor" stroke="none" /> : <Play className="w-5 h-5" fill="currentColor" stroke="none" />}
          </button>

          {/* Skip −10 */}
          <button onClick={() => skip(-10)} className="text-foreground/80 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-0.5" aria-label="Rewind 10 seconds">
            <RotateCcw className="w-4 h-4" />
            <span className="text-[10px] font-bold leading-none">10</span>
          </button>

          {/* Watch Highlights */}
          {scoreLogs && scoreLogs.length > 0 && (
             <button
               onClick={() => { setAutoHighlightsMode(!autoHighlightsMode); showHint(autoHighlightsMode ? "Highlights Off" : "Highlights On"); }}
               className={`text-[10px] md:text-xs font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm border ${autoHighlightsMode ? 'bg-amber-500 text-on-accent border-amber-400' : 'bg-white/10 text-on-accent hover:bg-white/20 border-white/20'}`}
               title="Auto-Skip Dead Time"
             >
               <Sparkles className="w-3 h-3" /> Highlights
             </button>
          )}

          {/* Skip +10 */}
          <button onClick={() => skip(10)} className="text-foreground/80 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-0.5" aria-label="Forward 10 seconds">
            <span className="text-[10px] font-bold leading-none">10</span>
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Slow Mo Replay */}
          <button onClick={triggerSlowMoReplay} className="text-primary hover:text-primary/70 transition-colors px-2 py-1.5 rounded-lg hover:bg-primary/10 flex items-center gap-1 mx-1 border border-primary/20" title="5s Slow-Mo Replay">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold leading-none">5s</span>
            <span className="text-[10px] font-bold leading-none opacity-60">@0.5x</span>
          </button>

          {/* Mute */}
          <button onClick={toggleMute} className="text-foreground/80 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10" aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Time */}
          <span className="text-foreground/70 text-xs tabular-nums px-1 shrink-0">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          {/* Club Controls (Settings) */}
          <div className="relative">
            <button onClick={() => setShowClubControls((v) => !v)} className="text-foreground/80 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10" aria-label="Club Controls">
              <Settings className="w-4 h-4" />
            </button>
            {showClubControls && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 flex flex-col py-1">
                {/* Speed Toggle */}
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs text-foreground/70 font-bold">Speed</span>
                  <div className="flex gap-1">
                    {[0.5, 1, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => { setPlaybackRate(s); setShowClubControls(false); }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${speed === s ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-primary-foreground/70 hover:bg-white/20'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
                {/* Lock Controls */}
                <button onClick={() => { setIsLocked(true); setShowClubControls(false); }} className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/10 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Lock Screen
                </button>
                {/* Rotate */}
                <button onClick={() => {
                  try { if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); showHint("Orientation Unlocked"); } } catch {}
                  setShowClubControls(false);
                }} className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/10 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> Unlock Rotation
                </button>
                {/* Open in YouTube */}
                <a href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(currentTime)}s`} target="_blank" rel="noreferrer" onClick={() => { if (playing) togglePlay(); setShowClubControls(false); }} className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/10 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" /> Open in YouTube
                </a>
                {/* Help */}
                <button onClick={() => { setShowHelp(true); if (playing) togglePlay(); setShowClubControls(false); }} className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-white/10 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-sky-400" /> Help / Gestures
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-foreground/80 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10" aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
