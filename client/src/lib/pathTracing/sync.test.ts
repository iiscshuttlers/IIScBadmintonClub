import { describe, it, expect } from "vitest";
import { wallClockToVideoMs, computeRallyVideoWindow, clampWindowToVideoDuration } from "./sync";

const anchor = { wallClockIso: "2026-07-12T10:00:00.000Z", videoTimeMs: 5000 };

describe("wallClockToVideoMs", () => {
  it("returns the anchor's video time for the anchor's own wall-clock time", () => {
    expect(wallClockToVideoMs(anchor.wallClockIso, anchor)).toBe(5000);
  });

  it("offsets forward for a later wall-clock time", () => {
    const later = "2026-07-12T10:00:10.000Z"; // +10s
    expect(wallClockToVideoMs(later, anchor)).toBe(15000);
  });

  it("offsets backward for an earlier wall-clock time", () => {
    const earlier = "2026-07-12T09:59:58.000Z"; // -2s
    expect(wallClockToVideoMs(earlier, anchor)).toBe(3000);
  });
});

describe("computeRallyVideoWindow", () => {
  it("computes start/end from a rally's started_at and duration_ms", () => {
    const rally = { rally_number: 2, started_at: "2026-07-12T10:00:10.000Z", duration_ms: 4000 };
    const window = computeRallyVideoWindow(rally, anchor);
    expect(window.startMs).toBe(15000);
    expect(window.endMs).toBe(19000);
  });
});

describe("clampWindowToVideoDuration", () => {
  it("passes through a window fully inside the video", () => {
    const result = clampWindowToVideoDuration({ startMs: 1000, endMs: 2000 }, 60000);
    expect(result).toEqual({ startMs: 1000, endMs: 2000, clipped: false });
  });

  it("clamps a negative start time to 0", () => {
    const result = clampWindowToVideoDuration({ startMs: -500, endMs: 2000 }, 60000);
    expect(result.startMs).toBe(0);
    expect(result.endMs).toBe(2000);
    expect(result.clipped).toBe(true);
  });

  it("clamps an end time past the video duration", () => {
    const result = clampWindowToVideoDuration({ startMs: 58000, endMs: 65000 }, 60000);
    expect(result.startMs).toBe(58000);
    expect(result.endMs).toBe(60000);
    expect(result.clipped).toBe(true);
  });
});
