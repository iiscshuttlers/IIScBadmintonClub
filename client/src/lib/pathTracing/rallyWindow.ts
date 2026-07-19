import { computeRallyVideoWindow, clampWindowToVideoDuration, type RallyForSync, type SyncAnchor } from "./sync";

export interface RallyJob {
  rally_number: number;
  windowMs: { startMs: number; endMs: number };
}

export function buildRallyJobs(
  rallies: RallyForSync[],
  anchor: SyncAnchor,
  videoDurationMs: number,
): RallyJob[] {
  const sorted = [...rallies].sort((a, b) => a.rally_number - b.rally_number);
  const jobs: RallyJob[] = [];

  for (const rally of sorted) {
    const raw = computeRallyVideoWindow(rally, anchor);
    if (raw.endMs <= 0 || raw.startMs >= videoDurationMs) {
      console.warn(
        `Rally ${rally.rally_number} video window [${raw.startMs}, ${raw.endMs}] falls entirely outside ` +
          `the video (0-${videoDurationMs}ms); skipping.`,
      );
      continue;
    }
    const clamped = clampWindowToVideoDuration(raw, videoDurationMs);
    if (clamped.clipped) {
      console.warn(`Rally ${rally.rally_number} video window clipped to [${clamped.startMs}, ${clamped.endMs}]`);
    }
    jobs.push({ rally_number: rally.rally_number, windowMs: { startMs: clamped.startMs, endMs: clamped.endMs } });
  }

  return jobs;
}
