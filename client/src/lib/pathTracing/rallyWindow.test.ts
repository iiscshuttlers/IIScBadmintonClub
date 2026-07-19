import { describe, it, expect, vi, afterEach } from "vitest";
import { buildRallyJobs } from "./rallyWindow";

const anchor = { wallClockIso: "2026-07-12T10:00:00.000Z", videoTimeMs: 5000 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildRallyJobs", () => {
  it("orders jobs ascending by rally_number regardless of input order", () => {
    const rallies = [
      { rally_number: 2, started_at: "2026-07-12T10:00:10.000Z", duration_ms: 3000 },
      { rally_number: 1, started_at: "2026-07-12T10:00:00.000Z", duration_ms: 2000 },
    ];
    const jobs = buildRallyJobs(rallies, anchor, 60000);
    expect(jobs.map((j) => j.rally_number)).toEqual([1, 2]);
  });

  it("computes the correct window for each rally", () => {
    const rallies = [{ rally_number: 1, started_at: "2026-07-12T10:00:00.000Z", duration_ms: 2000 }];
    const jobs = buildRallyJobs(rallies, anchor, 60000);
    expect(jobs[0].windowMs).toEqual({ startMs: 5000, endMs: 7000 });
  });

  it("filters out rallies entirely outside the video duration", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rallies = [
      { rally_number: 1, started_at: "2026-07-12T10:00:00.000Z", duration_ms: 2000 },
      { rally_number: 2, started_at: "2026-07-12T11:00:00.000Z", duration_ms: 2000 }, // way past video end
    ];
    const jobs = buildRallyJobs(rallies, anchor, 60000);
    expect(jobs.map((j) => j.rally_number)).toEqual([1]);
  });

  it("clips a window that partially overruns the video duration", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rallies = [{ rally_number: 1, started_at: "2026-07-12T10:00:00.000Z", duration_ms: 120000 }];
    const jobs = buildRallyJobs(rallies, anchor, 60000);
    expect(jobs[0].windowMs).toEqual({ startMs: 5000, endMs: 60000 });
  });
});
