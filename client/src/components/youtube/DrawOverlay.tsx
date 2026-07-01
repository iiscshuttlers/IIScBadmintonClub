import React from "react";

interface DrawOverlayProps {
  isDrawMode: boolean;
  drawLines: { x: number; y: number }[][];
  currentLine: { x: number; y: number }[];
  setDrawLines: React.Dispatch<React.SetStateAction<{ x: number; y: number }[][]>>;
  setCurrentLine: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  setIsDrawMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export function DrawOverlay({
  isDrawMode,
  drawLines,
  currentLine,
  setDrawLines,
  setCurrentLine,
  setIsDrawMode,
}: DrawOverlayProps) {
  if (!isDrawMode) return null;

  return (
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
        <button onClick={(e) => { e.stopPropagation(); setIsDrawMode(false); setDrawLines([]); setCurrentLine([]); }} className="text-primary hover:text-primary/70 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full text-xs font-bold transition-colors">Exit</button>
      </div>
    </div>
  );
}
