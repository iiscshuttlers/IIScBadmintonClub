import React from "react";
import type { ScoreLog } from "@/hooks/useYoutubePlayer";

interface ScoreboardOverlayProps {
  currentScore: ScoreLog | null;
  enableScoringMode: boolean;
  teamA: string[];
  teamB: string[];
  scoreLogs: ScoreLog[];
  handleAddPoint: (team: 'A' | 'B', playerIdx?: number) => void;
  handleSetServer: (serverIdx: number) => void;
  handleUndoScore: () => void;
  showHint: (msg: string) => void;
}

export function ScoreboardOverlay({
  currentScore,
  enableScoringMode,
  teamA,
  teamB,
  scoreLogs,
  handleAddPoint,
  handleSetServer,
  handleUndoScore,
  showHint,
}: ScoreboardOverlayProps) {
  if (!currentScore && !enableScoringMode) return null;

  return (
    <>
      <div className="absolute top-8 left-8 z-30 flex flex-col bg-[#1A1A1A]/95 border border-white/10 rounded shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto select-none min-w-[240px] md:min-w-[280px]">
        {/* Team A Row */}
        <div className="flex items-stretch border-b border-white/10 h-10 md:h-12">
          <div className="w-6 flex items-center justify-center bg-black/40 shrink-0">
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
          <div className="flex flex-col gap-1 bg-primary/80/80 backdrop-blur-sm border border-primary/30 p-2 rounded-xl mt-1">
            <span className="text-[10px] text-primary/50 font-bold uppercase tracking-widest pl-1 mb-1">Score Team B</span>
            {teamB.map((name, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); handleAddPoint('B', i + 2); }} className="bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg transition-colors flex items-center justify-between gap-3 text-left">
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
    </>
  );
}
