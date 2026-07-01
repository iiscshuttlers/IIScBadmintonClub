import React from "react";
import { HelpCircle, X } from "lucide-react";

interface HelpOverlayProps {
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
}

export function HelpOverlay({ showHelp, setShowHelp }: HelpOverlayProps) {
  if (!showHelp) return null;

  return (
    <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 text-foreground overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-800/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-primary" /> Gesture Cheat Sheet
          </h2>
          <button onClick={(e) => { e.stopPropagation(); setShowHelp(false); }} className="text-foreground/60 hover:text-foreground bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white/5 p-4 rounded-xl">
            <h3 className="font-bold text-primary mb-1">One-Finger Swipes</h3>
            <ul className="space-y-1.5 text-foreground/80 list-disc list-inside">
              <li><strong className="text-foreground">Left Edge (Up/Down):</strong> Brightness</li>
              <li><strong className="text-foreground">Right Edge (Up/Down):</strong> Volume</li>
              <li><strong className="text-foreground">Center (Left/Right):</strong> Precision Scrubbing</li>
              <li><strong className="text-foreground">Diagonal:</strong> Copy Timestamp Link</li>
              <li><strong className="text-foreground">From Top Edge (Down):</strong> Close Player</li>
            </ul>
          </div>
          <div className="bg-white/5 p-4 rounded-xl">
            <h3 className="font-bold text-cyan-400 mb-1">Multi-Touch & Taps</h3>
            <ul className="space-y-1.5 text-foreground/80 list-disc list-inside">
              <li><strong className="text-foreground">Two-Finger Pinch:</strong> Zoom & Pan</li>
              <li><strong className="text-foreground">Two-Finger Rotate:</strong> Change Speed</li>
              <li><strong className="text-foreground">Two-Finger Double Tap:</strong> A-B Loop (10s)</li>
              <li><strong className="text-foreground">Two-Finger Hold (0.5s):</strong> Telestrator Draw Mode</li>
              <li><strong className="text-foreground">Three-Finger Swipe Down:</strong> Boss Mode (Mute + Dark)</li>
              <li><strong className="text-foreground">Double Tap Sides:</strong> Skip ±10s</li>
              <li><strong className="text-foreground">Double Tap Center:</strong> Fullscreen</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
