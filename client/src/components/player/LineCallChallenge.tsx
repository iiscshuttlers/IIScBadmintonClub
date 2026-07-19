import { useState, useRef, useEffect } from "react";
import { Camera, Eye, Rewind, Play, Square, AlertCircle, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { InfoModal } from "@/components/InfoModal";

export function LineCallChallenge() {
  const [isActive, setIsActive] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.5);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const replayVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Keep rolling buffer of recent chunks (e.g. 2 chunks of 2 seconds each)
  const chunksRef = useRef<Blob[]>([]);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", frameRate: { ideal: 60 } }, 
        audio: false 
      });
      streamRef.current = stream;
      setIsActive(true);
      startRollingRecording(stream);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.message === "SECURE_CONTEXT_REQUIRED") {
        toast.error("HTTPS Required", { description: "Hawk-Eye Lite requires a secure connection or the Android App."});
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Permission Denied", { description: "Please allow camera access in your browser settings." });
      } else {
        toast.error("Failed to access camera for Hawk-Eye Lite");
      }
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
    setReplayUrl(null);
    chunksRef.current = [];
  };

  const startRollingRecording = (stream: MediaStream) => {
    try {
      // Use mp4 or webm based on browser support
      const options = { mimeType: 'video/webm;codecs=vp9' };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Keep only the last 3 chunks (approx 3-6 seconds if timeslice is 2000)
          if (chunksRef.current.length > 3) {
            chunksRef.current.shift();
          }
        }
      };

      // Request data every 2 seconds
      mediaRecorder.start(2000);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("MediaRecorder error:", err);
    }
  };

  const initiateChallenge = () => {
    setIsChallenging(true);
    
    // Stop requesting new data, but we don't necessarily stop the stream
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Stop to finalize the current chunk
      mediaRecorderRef.current.stop();
      
      // Wait a tiny bit for the last ondataavailable to fire
      setTimeout(() => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setReplayUrl(url);
        
        // Restart recording buffer
        if (streamRef.current) {
          chunksRef.current = [];
          startRollingRecording(streamRef.current);
        }
      }, 200);
    }
  };

  const closeChallenge = () => {
    setIsChallenging(false);
    if (replayUrl) {
      URL.revokeObjectURL(replayUrl);
      setReplayUrl(null);
    }
  };

  // Sync playback speed
  useEffect(() => {
    if (replayVideoRef.current) {
      replayVideoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, isChallenging]);

  // Attach stream when video element mounts
  useEffect(() => {
    if (isActive && !isChallenging && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Play error:", e));
    }
  }, [isActive, isChallenging]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-500" />
            "Hawk-Eye" Lite
            <InfoModal
              title="HAWK-EYE LITE"
              items={[
                { badge: "USAGE", title: "How to use", desc: "Leave your phone pointing at a controversial boundary line (like the baseline). If a dispute happens, tap 'Challenge'. The app instantly replays the last 4 seconds in extreme slow-motion so you can see if the shuttle was in or out." },
                { badge: "LOGIC", title: "How it works", desc: "It maintains a continuous 4-second looping video buffer in device memory. When you hit challenge, it halts the buffer and plays back those frames at 0.25x playback speed for line-judging." }
              ]}
            />
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Point phone at a boundary line. Tap Challenge for a slow-mo replay of the last 4 seconds.
          </p>
        </div>
        
        <button 
          onClick={isActive ? stopCamera : startCamera}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            isActive 
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
              : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
          }`}
        >
          {isActive ? <Square className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {isActive ? "Turn Off" : "Enable Camera"}
        </button>
      </div>

      {isActive && !isChallenging && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-700">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          
          {/* Target Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-1/2 h-8 border-2 border-dashed border-cyan-500/50 flex items-center justify-center">
              <span className="text-cyan-500/50 text-[10px] font-bold uppercase tracking-widest bg-black/40 px-2 rounded">Align with Line</span>
            </div>
          </div>
          
          <button 
            onClick={initiateChallenge}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest px-8 py-3 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] border-2 border-red-400 animate-pulse transition-all active:scale-95"
          >
            Challenge
          </button>
        </div>
      )}

      {isChallenging && replayUrl && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <div className="bg-red-600 px-3 py-1 text-xs font-black uppercase text-white rounded flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3 h-3" /> Review
            </div>
          </div>
          
          <video 
            ref={replayVideoRef} 
            src={replayUrl} 
            autoPlay 
            loop 
            playsInline 
            controls 
            className="w-full h-full object-contain"
          />
          
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold text-cyan-400">
              <span>Playback Speed: {playbackSpeed}x</span>
              <button onClick={closeChallenge} className="text-white bg-slate-800 px-3 py-1 rounded hover:bg-slate-700 transition">
                Close
              </button>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.1" 
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
