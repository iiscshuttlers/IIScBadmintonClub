import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { VideoImportStep } from "./VideoImportStep";
import { CalibrationStep } from "./CalibrationStep";
import { SyncStep } from "./SyncStep";
import { ProcessingStep } from "./ProcessingStep";
import { PathTraceViewer } from "./PathTraceViewer";
import { saveCalibration, type MatchSource } from "@/services/pathTracingService";
import type { Point2D } from "@/lib/pathTracing/homography";
import type { RallyForSync, SyncAnchor } from "@/lib/pathTracing/sync";

type WizardStep = "import" | "calibrate" | "sync" | "process" | "view";

export function PathTracingWizard({
  matchId,
  matchSource,
  userId,
  sessionTimestamp,
  onClose,
}: {
  matchId: string;
  matchSource: MatchSource;
  userId: string | null;
  sessionTimestamp?: string | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<WizardStep>("import");
  const [rallies, setRallies] = useState<RallyForSync[] | null>(null);
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; durationMs: number } | null>(null);
  const [calibration, setCalibration] = useState<{ id: string; homography: number[][] } | null>(null);
  const [syncAnchor, setSyncAnchor] = useState<{ anchor: SyncAnchor; rallyNumber: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("match_rally_stats")
      .select("rally_number, started_at, duration_ms")
      .eq("match_id", matchId)
      .eq("match_source", matchSource)
      .order("rally_number", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError("Failed to load rally data: " + error.message);
          return;
        }
        const rows = (data ?? []).filter((r) => r.started_at) as RallyForSync[];
        let finalRows = rows;
        if (finalRows.length === 0) {
          finalRows = [{
            rally_number: 1,
            started_at: sessionTimestamp || new Date().toISOString(),
            duration_ms: 3600000 // 1 hour dummy duration spanning the whole untracked session
          }];
        }
        setRallies(finalRows);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, matchSource, sessionTimestamp]);

  const handleCalibrationConfirm = async (result: { srcPoints: [Point2D, Point2D, Point2D, Point2D]; homography: number[][] }) => {
    setStep("sync");
    // persisted once sync is confirmed too (calibration row needs the sync fields);
    // stash the pending calibration input until sync completes
    pendingCalibrationRef.current = result;
  };

  const pendingCalibrationRef = useRef<{ srcPoints: [Point2D, Point2D, Point2D, Point2D]; homography: number[][] } | null>(null);

  const handleSyncConfirm = async (result: { anchor: SyncAnchor; rallyNumber: number }) => {
    const pending = pendingCalibrationRef.current;
    if (!pending || !videoInfo) return;
    setSyncAnchor(result);
    try {
      const saved = await saveCalibration({
        matchId,
        matchSource,
        srcPoints: pending.srcPoints,
        dstPoints: [
          [0, 0],
          [6.1, 0],
          [6.1, 13.4],
          [0, 13.4],
        ],
        homographyMatrix: pending.homography,
        videoFrameWidth: videoInfo.width,
        videoFrameHeight: videoInfo.height,
        syncAnchor: result.anchor,
        syncAnchorRallyNumber: result.rallyNumber,
        userId,
      });
      setCalibration(saved);
      setStep("process");
    } catch (err) {
      console.error("Failed to save calibration", err);
      setLoadError(err instanceof Error ? err.message : "Failed to save calibration");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto p-4">
      <div className="w-full max-w-lg mt-8 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-100">Court Path Tracing</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shared video element, reused across steps so the file isn't reloaded */}
        <video
          ref={videoRef}
          playsInline
          muted={step !== "sync"}
          controls={step === "sync"}
          className={step === "sync" ? "w-full rounded-xl mb-3 bg-black" : "opacity-0 absolute -z-10 w-1 h-1 pointer-events-none"}
        />

        {loadError && (
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 text-center text-[11px] text-rose-400">{loadError}</div>
        )}

        {!loadError && rallies === null && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 flex items-center justify-center text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading rally data...
          </div>
        )}

        {!loadError && rallies && rallies.length > 0 && (
          <>
            {step === "import" && (
              <VideoImportStep
                videoRef={videoRef}
                onImported={(info) => {
                  setVideoInfo(info);
                  setStep("calibrate");
                }}
              />
            )}

            {step === "calibrate" && videoInfo && (
              <CalibrationStep
                videoRef={videoRef}
                videoWidth={videoInfo.width}
                videoHeight={videoInfo.height}
                onConfirm={handleCalibrationConfirm}
              />
            )}

            {step === "sync" && <SyncStep videoRef={videoRef} rallies={rallies} onConfirm={handleSyncConfirm} />}

            {step === "process" && calibration && syncAnchor && videoInfo && (
              <ProcessingStep
                videoRef={videoRef}
                rallies={rallies}
                anchor={syncAnchor.anchor}
                videoDurationMs={videoInfo.durationMs}
                homography={calibration.homography}
                calibrationId={calibration.id}
                matchId={matchId}
                matchSource={matchSource}
                userId={userId}
                onDone={() => setStep("view")}
              />
            )}

            {step === "view" && <PathTraceViewer matchId={matchId} matchSource={matchSource} />}
          </>
        )}
      </div>
    </div>
  );
}
