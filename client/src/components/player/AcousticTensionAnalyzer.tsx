import { useState, useEffect, useRef } from "react";
import { Mic, Activity, RefreshCw } from "lucide-react";
import { StringTuner } from "@/lib/StringTuner";
import { InfoModal } from "@/components/InfoModal";

export function AcousticTensionAnalyzer() {
  const [isListening, setIsListening] = useState(false);
  const [tension, setTension] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const tunerRef = useRef<StringTuner | null>(null);
  
  // Throttle state updates for readability so it doesn't flicker wildly
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    tunerRef.current = new StringTuner((t, f) => {
      const now = Date.now();
      if (now - lastUpdateRef.current > 300) { // Only update UI every 300ms max
        setTension(t);
        setFrequency(f);
        lastUpdateRef.current = now;
      }
    });

    return () => {
      tunerRef.current?.stopListening();
    };
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      tunerRef.current?.stopListening();
      setIsListening(false);
    } else {
      try {
        await tunerRef.current?.startListening();
        setIsListening(true);
        setTension(null);
        setFrequency(null);
      } catch (err: any) {
        if (err.message === "SECURE_CONTEXT_REQUIRED") {
          alert("Microphone access requires a secure HTTPS connection or the Android App.");
        } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          alert("Microphone access was denied. Please allow microphone access in your browser settings.");
        } else {
          alert("Failed to access microphone for acoustic tension reading.");
        }
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Acoustic String Tuner
            <InfoModal
              title="ACOUSTIC STRING TUNER"
              items={[
                { badge: "USAGE", title: "How to use", desc: "Click the 'Tap to Ping String' button and grant microphone permissions. Then, tap your badminton racket strings near your phone. The app will display your current string tension in lbs." },
                { badge: "LOGIC", title: "How it works", desc: "It uses the Web Audio API to listen for the high-frequency 'ping' sound of the strings. It runs a fast Fourier transform (FFT) to find the dominant frequency (Hz) and converts it to tension (lbs) using a badminton string physics formula." }
              ]}
            />
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Tap your racket bed near the microphone to measure tension.
          </p>
        </div>
        <button 
          onClick={toggleListening}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            isListening 
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
              : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
          }`}
        >
          {isListening ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {isListening ? "Listening..." : "Start Tuning"}
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-700 min-h-[160px] relative overflow-hidden">
        {isListening && (
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {/* Simple audio wave visualization mock */}
            <div className="w-full h-full flex items-center justify-around">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-2 bg-emerald-400 rounded-full animate-pulse" 
                  style={{ height: `${Math.random() * 80 + 20}%`, animationDuration: `${Math.random() * 0.5 + 0.3}s` }}
                />
              ))}
            </div>
          </div>
        )}
        
        {tension !== null ? (
          <div className="text-center z-10 flex flex-col items-center gap-2">
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-500 tracking-tighter">
              {tension.toFixed(1)} <span className="text-2xl text-emerald-500/50">lbs</span>
            </div>
            <div className="text-sm text-slate-400 font-mono bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-700/50">
              Peak: {frequency} Hz
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-sm font-semibold flex flex-col items-center gap-2 z-10">
            {isListening ? "Waiting for ping..." : "Press Start Tuning"}
          </div>
        )}
      </div>
    </div>
  );
}
