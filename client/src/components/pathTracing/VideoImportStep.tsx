import { useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Video, Upload } from "lucide-react";
import { toast } from "sonner";
import { MediaPermissions } from "@/lib/mediaPermissions";

export function VideoImportStep({
  videoRef,
  onImported,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  onImported: (info: { width: number; height: number; durationMs: number }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { granted } = await MediaPermissions.requestVideoPermission();
        if (!granted) {
          toast.error("Video access is needed to import a match recording — enable it in app settings.");
          return;
        }
      } catch (err) {
        console.error("Failed to request video permission", err);
      }
    }
    fileInputRef.current?.click();
  };

  const handleFile = (file: File) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const objectUrl = URL.createObjectURL(file);
    videoEl.src = objectUrl;

    const onLoaded = () => {
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      if (!videoEl.videoWidth || !videoEl.videoHeight) {
        toast.error("Couldn't read video dimensions — try a different file");
        return;
      }
      onImported({
        width: videoEl.videoWidth,
        height: videoEl.videoHeight,
        durationMs: Math.round(videoEl.duration * 1000),
      });
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-center">
      <Video className="w-10 h-10 text-sky-400 mx-auto mb-3" />
      <h3 className="text-sm font-black text-slate-100 mb-1">Import Match Video</h3>
      <p className="text-[11px] text-slate-400 mb-4 max-w-sm mx-auto">
        Pick a video filmed separately (tripod-mounted, phone's normal camera app) showing the full court.
        Processing happens on this device — the video itself is never uploaded.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => void openPicker()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30 transition"
      >
        <Upload className="w-4 h-4" /> Choose Video File
      </button>
    </div>
  );
}
