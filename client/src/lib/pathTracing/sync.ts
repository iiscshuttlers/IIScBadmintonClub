// Correlates a match's wall-clock rally timestamps (match_rally_stats.started_at)
// with the imported video's own playback clock, via one manual anchor point.
// Deliberately reads only match_rally_stats fields — never match.pointLog —
// so umpired and practice-session matches share this exact code path (practice
// sessions have no pointLog at all).

export interface SyncAnchor {
  wallClockIso: string; // the anchor rally's match_rally_stats.started_at
  videoTimeMs: number;  // video.currentTime*1000 the user marked as that rally's start
}

export interface RallyForSync {
  rally_number: number;
  started_at: string;
  duration_ms: number;
}

export function wallClockToVideoMs(wallClockIso: string, anchor: SyncAnchor): number {
  const wallMs = new Date(wallClockIso).getTime();
  const anchorMs = new Date(anchor.wallClockIso).getTime();
  return anchor.videoTimeMs + (wallMs - anchorMs);
}

export function computeRallyVideoWindow(
  rally: RallyForSync,
  anchor: SyncAnchor,
): { startMs: number; endMs: number } {
  const startMs = wallClockToVideoMs(rally.started_at, anchor);
  return { startMs, endMs: startMs + rally.duration_ms };
}

export function clampWindowToVideoDuration(
  window: { startMs: number; endMs: number },
  videoDurationMs: number,
): { startMs: number; endMs: number; clipped: boolean } {
  const startMs = Math.max(0, window.startMs);
  const endMs = Math.min(videoDurationMs, window.endMs);
  const clipped = startMs !== window.startMs || endMs !== window.endMs;
  return { startMs, endMs, clipped };
}
