import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { applyHomography } from "@/lib/pathTracing/homography";
import { clampToCourt, isWithinCourtBounds, courtSide } from "@/lib/pathTracing/court";
import { computeSpeeds, type PathPoint } from "@/lib/pathTracing/speed";
import { extractPosesForWindow, resetLandmarker } from "@/lib/pathTracing/poseExtraction";
import { extractShuttlesForWindow } from "@/lib/pathTracing/videoAnalysis";
import { buildRallyJobs } from "@/lib/pathTracing/rallyWindow";
import type { RallyForSync, SyncAnchor } from "@/lib/pathTracing/sync";
import { savePaths, type MatchSource } from "@/services/pathTracingService";

// Simple greedy nearest-position tracker: assigns each frame's detections to
// up to 2 running tracks by proximity to that track's last known point. Good
// enough for singles (2 people, usually well separated on opposite halves)
// without a full re-identification model.
const MAX_TRACK_JUMP_M = 3;
const SAMPLE_RATE_HZ = 5;

interface TrackedSample {
  videoTimeMs: number;
  xM: number;
  yM: number;
  conf: number;
}

export function ProcessingStep({
  videoRef,
  rallies,
  anchor,
  videoDurationMs,
  homography,
  calibrationId,
  matchId,
  matchSource,
  userId,
  onDone,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  rallies: RallyForSync[];
  anchor: SyncAnchor;
  videoDurationMs: number;
  homography: number[][];
  calibrationId: string;
  matchId: string;
  matchSource: MatchSource;
  userId: string | null;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Starting...");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    const video = videoRef.current;
    if (!video) {
      setError("Video element not available");
      return;
    }

    try {
      await resetLandmarker();
      const jobs = buildRallyJobs(rallies, anchor, videoDurationMs);
      const paths: Array<{ rally_number: number; side: "near" | "far" | "shuttle"; points: PathPoint[] }> = [];

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        setLabel(`Processing rally ${job.rally_number} (${i + 1}/${jobs.length})...`);

        const rawSamples = await extractPosesForWindow(video, job.windowMs, SAMPLE_RATE_HZ, (pct) => {
          setProgress(((i + pct) / jobs.length) * 0.8); // 80% weight for pose extraction
        });
        
        const shuttleSamples = await extractShuttlesForWindow(video, job.windowMs, 15, (pct) => {
          setProgress(((i + 0.8 + pct * 0.2) / jobs.length)); // 20% weight for shuttle tracking
        });

        const tracks: TrackedSample[][] = [];
        for (const sample of rawSamples) {
          const projected = sample.detections
            .map((d) => {
              const [xM, yM] = clampToCourt(applyHomography(homography, d.ankleMidpointPx));
              return { xM, yM, conf: d.visibility };
            })
            .filter((p) => isWithinCourtBounds([p.xM, p.yM]));

          const used = new Set<number>();
          for (const p of projected) {
            let bestTrack = -1;
            let bestDist = Infinity;
            tracks.forEach((track, ti) => {
              if (used.has(ti) || track.length === 0) return;
              const last = track[track.length - 1];
              const d = Math.hypot(p.xM - last.xM, p.yM - last.yM);
              if (d < bestDist) {
                bestDist = d;
                bestTrack = ti;
              }
            });

            if (bestTrack >= 0 && bestDist < MAX_TRACK_JUMP_M) {
              tracks[bestTrack].push({ videoTimeMs: sample.videoTimeMs, ...p });
              used.add(bestTrack);
            } else if (tracks.length < 2) {
              tracks.push([{ videoTimeMs: sample.videoTimeMs, ...p }]);
              used.add(tracks.length - 1);
            }
          }
        }

        for (const track of tracks) {
          if (track.length < 2) continue; // too sparse to be a meaningful path
          const early = track.filter((t) => t.videoTimeMs - job.windowMs.startMs <= 500);
          const refSamples = early.length ? early : track.slice(0, 1);
          const avgY = refSamples.reduce((s, p) => s + p.yM, 0) / refSamples.length;
          const side = courtSide(avgY);
          const points = computeSpeeds(track, job.windowMs.startMs);
          paths.push({ rally_number: job.rally_number, side, points });
        }

        // Process Shuttlecock path
        const shuttlePoints: PathPoint[] = [];
        for (const sample of shuttleSamples) {
          if (sample.detection) {
            const [xM, yM] = clampToCourt(applyHomography(homography, [sample.detection.xPx, sample.detection.yPx]));
            // Only include points that are actually on court
            if (isWithinCourtBounds([xM, yM])) {
              shuttlePoints.push({
                t_ms: sample.videoTimeMs - job.windowMs.startMs,
                x_m: xM,
                y_m: yM,
                speed_mps: 0, // Shuttle speed calculation needs >15hz, set to 0 for now
                conf: sample.detection.confidence
              });
            }
          }
        }
        if (shuttlePoints.length > 0) {
          paths.push({ rally_number: job.rally_number, side: "shuttle", points: shuttlePoints });
        }
      }

      setLabel("Saving results...");
      await savePaths({ matchId, matchSource, calibrationId, userId, paths });
      onDone();
    } catch (err) {
      console.error("Path processing failed", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-rose-400 mb-1">Processing failed</p>
        <p className="text-[11px] text-slate-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-center">
      <Loader2 className="w-8 h-8 text-sky-400 mx-auto mb-3 animate-spin" />
      <p className="text-xs font-bold text-slate-200 mb-3">{label}</p>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden max-w-xs mx-auto">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-2">Keep this screen open until processing finishes.</p>
    </div>
  );
}
