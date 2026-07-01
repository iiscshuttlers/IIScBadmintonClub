import React, { forwardRef, useImperativeHandle } from "react";
import { Play, Unlock } from "lucide-react";
import { useYoutubePlayer } from "@/hooks/useYoutubePlayer";
import type { Chapter, YoutubePlayerHandle, ScoreLog } from "@/hooks/useYoutubePlayer";
export type { Chapter, YoutubePlayerHandle, ScoreLog };

import { ScoreboardOverlay } from "./youtube/ScoreboardOverlay";
import { PlayerControls } from "./youtube/PlayerControls";
import { DrawOverlay } from "./youtube/DrawOverlay";
import { HelpOverlay } from "./youtube/HelpOverlay";

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

export const YoutubePlayer = forwardRef<YoutubePlayerHandle, Props>(
  function YoutubePlayer(
    { videoId, chapters = [], className, onTimeUpdate, scoreLogs = [], teamA = ["Team A"], teamB = ["Team B"], enableScoringMode = false, onScoreLogsChange },
    ref,
  ) {
    const player = useYoutubePlayer({
      videoId, chapters, onTimeUpdate, scoreLogs, teamA, teamB, onScoreLogsChange
    });

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => player.seekTo(seconds, false),
    }));

    const {
      containerRef, divId, ready, playing, brightness, zoomParams,
      isDrawMode, drawLines, currentLine, setDrawLines, setCurrentLine, setIsDrawMode,
      showHelp, setShowHelp, isLocked, setIsLocked, revealControls, setShowControls,
      currentScore, handleAddPoint, handleSetServer, handleUndoScore, showHint,
      gestures
    } = player;

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

        <ScoreboardOverlay 
          currentScore={currentScore}
          enableScoringMode={enableScoringMode}
          teamA={teamA}
          teamB={teamB}
          scoreLogs={scoreLogs}
          handleAddPoint={handleAddPoint}
          handleSetServer={handleSetServer}
          handleUndoScore={handleUndoScore}
          showHint={showHint}
        />

        {/* Loading spinner */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        <DrawOverlay 
          isDrawMode={isDrawMode}
          drawLines={drawLines}
          currentLine={currentLine}
          setDrawLines={setDrawLines}
          setCurrentLine={setCurrentLine}
          setIsDrawMode={setIsDrawMode}
        />

        <HelpOverlay showHelp={showHelp} setShowHelp={setShowHelp} />

        {/* Gesture overlay */}
        <div
          className="absolute inset-x-0 top-0 bottom-[25%] z-20 cursor-pointer touch-none"
          onTouchStart={gestures.handleTouchStart}
          onTouchMove={gestures.handleTouchMove}
          onTouchEnd={gestures.handleTouchEnd}
          onClick={gestures.handleClick}
          onDoubleClick={(e) => {
            if (isLocked) return;
            const { width } = e.currentTarget.getBoundingClientRect();
            if (e.clientX < width / 2) {
              player.skip(-10);
              showHint("⏪ 10s");
            } else {
              player.skip(10);
              showHint("10s ⏩");
            }
            player.preventClickRef.current = true;
          }}
        />

        {/* Gesture Hint overlay */}
        {player.showGestureHint && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-200">
            <div className="bg-black/60 backdrop-blur-md text-white font-bold px-6 py-3 rounded-full text-lg shadow-2xl flex items-center gap-2">
              {player.showGestureHint.text}
            </div>
          </div>
        )}

        {/* Big play button in center when paused */}
        {ready && !playing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-9 h-9 text-white" fill="white" />
            </div>
          </div>
        )}

        <PlayerControls 
          player={player} 
          videoId={videoId} 
          chapters={chapters} 
          scoreLogs={scoreLogs} 
        />

        {/* Lock Overlay */}
        {isLocked && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 opacity-100">
             <button onClick={(e) => { e.stopPropagation(); setIsLocked(false); showHint("Screen Unlocked"); }} className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full shadow-lg text-white pointer-events-auto flex items-center justify-center border border-white/20">
               <Unlock className="w-6 h-6" />
             </button>
          </div>
        )}
      </div>
    );
  },
);
