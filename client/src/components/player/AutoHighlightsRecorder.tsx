import { useState, useRef, useEffect } from "react";
import { Camera, Film, Download, StopCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { InfoModal } from "@/components/InfoModal";

export function AutoHighlightsRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Audio analysis
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Rolling buffer (keep 15-20 seconds worth of chunks)
  // At 1 chunk per second, we keep ~20 chunks
  const chunksRef = useRef<Blob[]>([]);
  const CHUNK_MS = 1000; // 1 second chunks
  const MAX_CHUNKS = 15; // 15 seconds history
  
  // Cooldown to prevent multiple triggers for the same rally
  const lastTriggerRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true // Important for sound-based triggers
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsRecording(true);
      setHighlightUrl(null);
      chunksRef.current = [];
      
      startMediaRecorder(stream);
      startAudioAnalysis(stream);
    } catch (err: any) {
      console.error("Camera access failed", err);
      if (err.message === "SECURE_CONTEXT_REQUIRED") {
        toast.error("HTTPS Required", { description: "Camera access requires a secure connection or the Android App."});
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Permission Denied", { description: "Please allow camera & microphone access in your browser settings." });
      } else {
        toast.error("Failed to access camera/mic for Auto-Highlights");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    cancelAnimationFrame(animationFrameRef.current);
    
    setIsRecording(false);
  };

  const startMediaRecorder = (stream: MediaStream) => {
    try {
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          if (chunksRef.current.length > MAX_CHUNKS) {
            chunksRef.current.shift(); // Remove oldest chunk
          }
        }
      };

      mediaRecorder.start(CHUNK_MS); // Slice data every second
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.error("MediaRecorder start failed", err);
    }
  };

  const startAudioAnalysis = (stream: MediaStream) => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      const now = Date.now();
      // Threshold: 180 (loud sound like a smash or a shout)
      // Cooldown: 15 seconds before capturing another highlight
      if (average > 180 && now - lastTriggerRef.current > 15000) {
        lastTriggerRef.current = now;
        triggerHighlightCapture();
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  const triggerHighlightCapture = () => {
    toast.success("💥 Huge smash detected! Saving highlight...");
    
    // We want to wait a few seconds to capture the *aftermath* of the smash
    setTimeout(() => {
      if (chunksRef.current.length === 0) return;
      
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setHighlightUrl(url);
      
      // We don't stop recording, we just save the current buffer and keep going!
      toast.success("Highlight ready for review/download!");
    }, 3000); // Wait 3 seconds after the smash to compile the clip
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Auto-Highlights Engine
            <InfoModal
              title="AUTO-HIGHLIGHTS ENGINE"
              items={[
                { badge: "USAGE", title: "How to use", desc: "Mount your phone on a tripod facing the court and hit Record. Play your game normally. Whenever you hit a massive smash or cheer loudly, the app automatically saves the last 15 seconds of video as a highlight clip!" },
                { badge: "LOGIC", title: "How it works", desc: "It uses the MediaRecorder API to record video in a continuous 15-second rolling buffer. Simultaneously, it uses the Web Audio API (AudioContext AnalyserNode) to monitor volume spikes. When a decibel threshold is breached, it stitches the buffer into a downloadable Blob." }
              ]}
            />
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Leave phone recording. Auto-saves 15s clips when it hears a massive smash!
          </p>
        </div>
        
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition ${
            isRecording 
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
              : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
          }`}
        >
          {isRecording ? <StopCircle className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          {isRecording ? "Stop Camera" : "Start Auto-Highlights"}
        </button>
      </div>

      {isRecording && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-700 mb-4">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Listening for Smashes</span>
          </div>
          
          <button 
            onClick={() => {
              lastTriggerRef.current = Date.now();
              triggerHighlightCapture();
            }}
            className="absolute bottom-4 right-4 bg-slate-800/80 hover:bg-slate-700 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-lg transition"
          >
            Manual Clip (Save Last 15s)
          </button>
        </div>
      )}

      {highlightUrl && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-200">Highlight Captured!</div>
              <div className="text-[10px] text-slate-400">15-second clip</div>
            </div>
          </div>
          <div className="flex gap-2">
            <a 
              href={highlightUrl} 
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-300 transition"
            >
              Watch
            </a>
            <a 
              href={highlightUrl} 
              download={`highlight-${Date.now()}.webm`}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-lg text-xs font-bold transition"
            >
              <Download className="w-3 h-3" /> Save
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
