export interface PathPoint {
  t_ms: number;
  x_m: number;
  y_m: number;
  speed_mps: number;
  conf: number;
}

export interface CourtSample {
  videoTimeMs: number;
  xM: number;
  yM: number;
  conf: number;
}

// Speed at each sample is displacement-since-previous-sample / dt; the first
// sample in a rally has no predecessor so its speed is 0.
export function computeSpeeds(rawSamples: CourtSample[], rallyStartVideoMs: number): PathPoint[] {
  const sorted = [...rawSamples].sort((a, b) => a.videoTimeMs - b.videoTimeMs);
  const points: PathPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    let speedMps = 0;
    if (i > 0) {
      const prev = sorted[i - 1];
      const dtSec = (s.videoTimeMs - prev.videoTimeMs) / 1000;
      if (dtSec > 0) {
        const dx = s.xM - prev.xM;
        const dy = s.yM - prev.yM;
        speedMps = Math.sqrt(dx * dx + dy * dy) / dtSec;
      }
    }
    points.push({
      t_ms: s.videoTimeMs - rallyStartVideoMs,
      x_m: s.xM,
      y_m: s.yM,
      speed_mps: speedMps,
      conf: s.conf,
    });
  }

  return points;
}
