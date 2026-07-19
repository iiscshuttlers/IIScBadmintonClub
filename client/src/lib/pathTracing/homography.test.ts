import { describe, it, expect } from "vitest";
import { computeHomography, applyHomography, invertHomography, solveLinearSystem } from "./homography";
import { CANONICAL_COURT_CORNERS } from "./court";

describe("solveLinearSystem", () => {
  it("solves a simple 2x2 system", () => {
    // x + y = 3, x - y = 1 -> x=2, y=1
    const result = solveLinearSystem([[1, 1], [1, -1]], [3, 1]);
    expect(result[0]).toBeCloseTo(2);
    expect(result[1]).toBeCloseTo(1);
  });

  it("throws on a singular matrix", () => {
    expect(() => solveLinearSystem([[1, 1], [2, 2]], [3, 6])).toThrow();
  });
});

describe("computeHomography / applyHomography", () => {
  it("recovers an identity mapping when src === dst", () => {
    const pts: [any, any, any, any] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const H = computeHomography(pts, pts);
    expect(applyHomography(H, [0.3, 0.7])[0]).toBeCloseTo(0.3);
    expect(applyHomography(H, [0.3, 0.7])[1]).toBeCloseTo(0.7);
  });

  it("maps a unit square onto the canonical court corners", () => {
    const src: [any, any, any, any] = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const H = computeHomography(src, CANONICAL_COURT_CORNERS);

    const [x0, y0] = applyHomography(H, [0, 0]);
    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(0);

    const [x1, y1] = applyHomography(H, [100, 100]);
    expect(x1).toBeCloseTo(6.1);
    expect(y1).toBeCloseTo(13.4);

    // center of the pixel square should map to the center of the court
    const [xc, yc] = applyHomography(H, [50, 50]);
    expect(xc).toBeCloseTo(3.05, 1);
    expect(yc).toBeCloseTo(6.7, 1);
  });

  it("handles genuine perspective (non-affine) correspondences", () => {
    // A trapezoid in pixel space (near side wider than far side, as a camera
    // looking down a court would produce) mapped onto a true rectangle.
    const src: [any, any, any, any] = [
      [0, 480],    // near-left (wide, close to camera)
      [640, 480],  // near-right
      [560, 0],    // far-right (narrower, further away)
      [80, 0],     // far-left
    ];
    const H = computeHomography(src, CANONICAL_COURT_CORNERS);

    for (let i = 0; i < 4; i++) {
      const [x, y] = applyHomography(H, src[i]);
      expect(x).toBeCloseTo(CANONICAL_COURT_CORNERS[i][0], 3);
      expect(y).toBeCloseTo(CANONICAL_COURT_CORNERS[i][1], 3);
    }
  });
});

describe("invertHomography", () => {
  it("round-trips a point through H and H^-1", () => {
    const src: [any, any, any, any] = [[10, 400], [630, 400], [560, 20], [80, 20]];
    const H = computeHomography(src, CANONICAL_COURT_CORNERS);
    const Hinv = invertHomography(H);

    const courtPoint: [number, number] = [3.0, 5.0];
    const pixel = applyHomography(Hinv, courtPoint);
    const back = applyHomography(H, pixel);

    expect(back[0]).toBeCloseTo(courtPoint[0], 3);
    expect(back[1]).toBeCloseTo(courtPoint[1], 3);
  });

  it("throws on a singular matrix", () => {
    const singular = [[1, 2, 3], [2, 4, 6], [1, 1, 1]];
    expect(() => invertHomography(singular)).toThrow();
  });
});
