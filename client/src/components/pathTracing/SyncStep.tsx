import { useState } from "react";
import { Target, Check } from "lucide-react";
import type { RallyForSync, SyncAnchor } from "@/lib/pathTracing/sync";

export function SyncStep({
  videoRef,
  rallies,
  onConfirm,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  rallies: RallyForSync[];
  onConfirm: (result: { anchor: SyncAnchor; rallyNumber: number }) => void;
}) {
  const [rallyNumber, setRallyNumber] = useState(rallies[0]?.rally_number ?? 1);
  const [markedMs, setMarkedMs] = useState<number | null>(null);

  const selectedRally = rallies.find((r) => r.rally_number === rallyNumber);

  const markHere = () => {
    const video = videoRef.current;
    if (!video) return;
    setMarkedMs(Math.round(video.currentTime * 1000));
  };

  const confirm = () => {
    if (markedMs === null || !selectedRally) return;
    onConfirm({
      anchor: { wallClockIso: selectedRally.started_at, videoTimeMs: markedMs },
      rallyNumber: selectedRally.rally_number,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
      <h3 className="text-sm font-black text-slate-100 mb-1">Sync Video to Rallies</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        Scrub the video (above) to the exact moment a rally's serve begins, pick that rally below, then mark it.
      </p>

      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Anchor rally</label>
      <select
        value={rallyNumber}
        onChange={(e) => {
          setRallyNumber(Number(e.target.value));
          setMarkedMs(null);
        }}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-100 mb-3"
      >
        {rallies.map((r) => (
          <option key={r.rally_number} value={r.rally_number}>
            Rally {r.rally_number} ({(r.duration_ms / 1000).toFixed(1)}s)
          </option>
        ))}
      </select>

      <button
        onClick={markHere}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30 mb-3"
      >
        <Target className="w-4 h-4" /> Mark sync point at current video position
      </button>

      {markedMs !== null && (
        <p className="text-[11px] text-slate-400 mb-3 text-center">
          Rally {rallyNumber} start marked at <span className="font-bold text-slate-200">{(markedMs / 1000).toFixed(2)}s</span> into the video.
        </p>
      )}

      <button
        onClick={confirm}
        disabled={markedMs === null}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-primary/20 text-primary border border-primary/30 disabled:opacity-40"
      >
        <Check className="w-4 h-4" /> Confirm sync
      </button>
    </div>
  );
}
