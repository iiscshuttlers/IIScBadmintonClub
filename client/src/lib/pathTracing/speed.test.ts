import { describe, it, expect } from "vitest";
import { computeSpeeds } from "./speed";

describe("computeSpeeds", () => {
  it("assigns speed 0 to the first sample", () => {
    const points = computeSpeeds([{ videoTimeMs: 1000, xM: 3, yM: 5, conf: 1 }], 1000);
    expect(points[0].speed_mps).toBe(0);
    expect(points[0].t_ms).toBe(0);
  });

  it("computes speed as distance/dt between consecutive samples", () => {
    // moves 3m in x over 1s -> 3 m/s
    const points = computeSpeeds(
      [
        { videoTimeMs: 1000, xM: 0, yM: 0, conf: 1 },
        { videoTimeMs: 2000, xM: 3, yM: 0, conf: 1 },
      ],
      1000,
    );
    expect(points[1].speed_mps).toBeCloseTo(3);
    expect(points[1].t_ms).toBe(1000);
  });

  it("computes diagonal displacement via euclidean distance", () => {
    // 3-4-5 triangle over 1s -> 5 m/s
    const points = computeSpeeds(
      [
        { videoTimeMs: 0, xM: 0, yM: 0, conf: 1 },
        { videoTimeMs: 1000, xM: 3, yM: 4, conf: 1 },
      ],
      0,
    );
    expect(points[1].speed_mps).toBeCloseTo(5);
  });

  it("sorts out-of-order input by videoTimeMs before computing speed", () => {
    const points = computeSpeeds(
      [
        { videoTimeMs: 2000, xM: 3, yM: 0, conf: 1 },
        { videoTimeMs: 1000, xM: 0, yM: 0, conf: 1 },
      ],
      1000,
    );
    expect(points[0].t_ms).toBe(0);
    expect(points[1].t_ms).toBe(1000);
    expect(points[1].speed_mps).toBeCloseTo(3);
  });

  it("preserves confidence values", () => {
    const points = computeSpeeds([{ videoTimeMs: 0, xM: 0, yM: 0, conf: 0.6 }], 0);
    expect(points[0].conf).toBe(0.6);
  });
});
