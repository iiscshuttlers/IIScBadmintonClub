import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, Volume2, Flame } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { InfoModal } from "@/components/InfoModal";

const CORNERS = [
  { id: "front-left", label: "Front Left", row: 0, col: 0 },
  { id: "front-right", label: "Front Right", row: 0, col: 1 },
  { id: "mid-left", label: "Mid Left", row: 1, col: 0 },
  { id: "mid-right", label: "Mid Right", row: 1, col: 1 },
  { id: "back-left", label: "Back Left", row: 2, col: 0 },
  { id: "back-right", label: "Back Right", row: 2, col: 1 },
];

export function ShadowDrillEngine() {
  const [isActive, setIsActive] = useState(false);
  const [intervalMs, setIntervalMs] = useState(3000); // Default 3s
  const [currentCorner, setCurrentCorner] = useState<string | null>(null);
  const [drillCount, setDrillCount] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      stopDrill();
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.speak({
          text: text,
          lang: 'en-US',
          rate: 1.2,
          pitch: 1.0,
        });
      } catch (err) {
        console.error("TTS Error:", err);
      }
      return;
    }

    if (!synthRef.current) return;
    // Cancel any ongoing speech
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.2; // Slightly faster for drills
    utterance.pitch = 1;
    utteranceRef.current = utterance; // Prevent Garbage Collection bug in Chrome/Android
    synthRef.current.speak(utterance);
    
    // Kickstart if it's stuck in a paused state (iOS/Android quirk)
    if (synthRef.current.paused) {
      synthRef.current.resume();
    }
  }, []);

  const nextMove = useCallback(() => {
    const randomCorner = CORNERS[Math.floor(Math.random() * CORNERS.length)];
    setCurrentCorner(randomCorner.id);
    setDrillCount(prev => prev + 1);
    speak(randomCorner.label);
  }, [speak]);

  const startDrill = () => {
    setIsActive(true);
    setDrillCount(0);
    setCurrentCorner(null);
    speak("Starting shadow drills. Ready.");
    
    // Initial delay before first move
    setTimeout(() => {
      nextMove();
      timerRef.current = setInterval(nextMove, intervalMs);
    }, 2000);
  };

  const stopDrill = () => {
    setIsActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentCorner(null);
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(console.error);
    } else {
      synthRef.current?.cancel();
    }
  };

  const toggleDrill = () => {
    if (isActive) stopDrill();
    else startDrill();
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            AI Shadow Drills
            <InfoModal
              title="AI SHADOW DRILLS"
              items={[
                { badge: "USAGE", title: "How to use", desc: "Select your difficulty (speed) and press Play. Place your phone nearby with the volume up. The AI coach will randomly call out court corners (e.g., 'Front Left'). Move to that corner as fast as possible, then return to base." },
                { badge: "LOGIC", title: "How it works", desc: "It uses the browser's native SpeechSynthesis API to vocalize random coordinates from a weighted array, running on a fixed `setInterval` loop determined by your difficulty selection." }
              ]}
            />
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Follow the audio cues for random footwork practice.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={intervalMs} 
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            disabled={isActive}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2 py-2 outline-none"
          >
            <option value={4000}>Easy (4s)</option>
            <option value={3000}>Medium (3s)</option>
            <option value={2000}>Hard (2s)</option>
            <option value={1500}>Pro (1.5s)</option>
          </select>
          
          <button 
            onClick={toggleDrill}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
              isActive 
                ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
                : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30"
            }`}
          >
            {isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isActive ? "Stop" : "Start"}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-center">
        {/* 2D Court Visualization (Half Court) */}
        <div className="relative w-32 h-40 bg-emerald-700/20 border-2 border-emerald-500/30 rounded-md p-2 grid grid-cols-2 grid-rows-3 gap-1 mx-auto overflow-hidden">
          {/* Net Line (At the top) */}
          <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-200 z-10 shadow-[0_2px_4px_rgba(255,255,255,0.3)]" />
          
          {CORNERS.map(corner => (
            <div 
              key={corner.id}
              className={`rounded-sm transition-all duration-300 flex items-center justify-center ${
                currentCorner === corner.id 
                  ? "bg-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-95" 
                  : "bg-emerald-900/40"
              }`}
            >
              {currentCorner === corner.id && (
                <div className="w-3 h-3 bg-white rounded-full animate-ping" />
              )}
            </div>
          ))}
          
          {/* Base Position Indicator (Center of the half court) */}
          <div className="absolute top-1/2 left-1/2 w-4 h-4 border-2 border-sky-400 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-50">
            <div className="w-1 h-1 bg-sky-400 rounded-full" />
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 bg-slate-800 rounded-xl border border-slate-700">
          <Volume2 className={`w-8 h-8 mb-2 ${isActive ? "text-orange-400 animate-pulse" : "text-slate-600"}`} />
          <div className="text-3xl font-black text-slate-100 font-mono tracking-wider">
            {drillCount}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
            Moves Completed
          </div>
        </div>
      </div>
    </div>
  );
}
