import { useState, useRef, useEffect } from "react";
import { Glasses, Play, Square, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { InfoModal } from "@/components/InfoModal";

export function ARReplayViewer() {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Dummy path data representing a player moving around the court
  const dummyPath = [
    { x: 50, y: 80 }, { x: 40, y: 70 }, { x: 20, y: 30 }, { x: 30, y: 20 },
    { x: 70, y: 25 }, { x: 80, y: 50 }, { x: 50, y: 80 }
  ];
  
  const [pathIndex, setPathIndex] = useState(0);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.message === "SECURE_CONTEXT_REQUIRED") {
        toast.error("HTTPS Required", { description: "AR Replays require a secure connection or the Android App."});
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Permission Denied", { description: "Please allow camera access in your browser settings." });
      } else {
        toast.error("Failed to access camera for AR");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl mb-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Glasses className="w-4 h-4 text-purple-500" />
            AR 3D Replays
            <InfoModal 
            title="AR 3D Replays"
            items={[
              {
                badge: "How it works",
                title: "Augmented Reality Projection",
                desc: "This feature uses your device's camera as a background, and overlays a 3D animated badminton court on top of it using CSS 3D transforms. It simulates AR without needing expensive hardware!"
              },
              {
                badge: "Calibration",
                title: "Tracking Feels Weird?",
                desc: "If the court drifts or feels weird, your phone's internal gyroscope might be uncalibrated. Move your phone in a large Figure-8 motion in the air to calibrate the sensors."
              }
            ]}
          />
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Project match data onto the real world using augmented reality.
          </p>
        </div>
        
        <button 
          onClick={isActive ? stopCamera : startCamera}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            isActive 
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
              : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30"
          }`}
        >
          {isActive ? <Square className="w-4 h-4" /> : <Glasses className="w-4 h-4" />}
          {isActive ? "Close AR" : "Enter AR"}
        </button>
      </div>

      {isActive && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video border border-slate-700">
          {/* Camera Feed */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          
          {/* AR Overlay (3D CSS transformed court) */}
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-20 perspective-[800px]">
            <div className="w-64 h-96 border-2 border-emerald-400/50 bg-emerald-900/20 grid grid-cols-2 grid-rows-2 relative transform rotate-x-[60deg] shadow-[0_0_50px_rgba(52,211,153,0.2)]">
              {/* Net */}
              <div className="absolute top-1/2 left-0 w-full h-0 border-t-2 border-white/50 -translate-y-1/2" />
              {/* Player Path Trace */}
              {dummyPath.map((point, i) => (
                <div 
                  key={i}
                  className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]"
                  style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {i > 0 && (
                    <svg className="absolute top-1/2 left-1/2 overflow-visible -z-10" style={{ transform: 'translate(-50%, -50%)' }}>
                      <line 
                        x1="0" y1="0" 
                        x2={(dummyPath[i-1].x - point.x) * 2.5} 
                        y2={(dummyPath[i-1].y - point.y) * 3.8} 
                        stroke="rgba(255,255,255,0.4)" 
                        strokeWidth="2" 
                        strokeDasharray="4 2"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
          

          
          <div className="absolute top-4 left-4 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur border border-white/10 uppercase tracking-widest">
            AR Tracking Active
          </div>
        </div>
      )}
    </div>
  );
}
