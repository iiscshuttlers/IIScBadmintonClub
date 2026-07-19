import type { Point2D } from "./homography";

export const COURT_WIDTH_M = 6.1;
export const COURT_LENGTH_M = 13.4;
export const NET_Y_M = COURT_LENGTH_M / 2;

// Canonical corner order used everywhere calibration points are collected/stored.
export const CANONICAL_COURT_CORNERS: [Point2D, Point2D, Point2D, Point2D] = [
  [0, 0],
  [COURT_WIDTH_M, 0],
  [COURT_WIDTH_M, COURT_LENGTH_M],
  [0, COURT_LENGTH_M],
];

export function courtSide(yMeters: number): "near" | "far" {
  return yMeters < NET_Y_M ? "near" : "far";
}

// Guards perspective-projection outliers (e.g. a spectator near the court edge)
// without being so strict that a player diving near the boundary gets dropped.
export function clampToCourt(p: Point2D, marginM = 1): Point2D {
  const [x, y] = p;
  return [
    Math.min(COURT_WIDTH_M + marginM, Math.max(-marginM, x)),
    Math.min(COURT_LENGTH_M + marginM, Math.max(-marginM, y)),
  ];
}

export function isWithinCourtBounds(p: Point2D, marginM = 1): boolean {
  const [x, y] = p;
  return x >= -marginM && x <= COURT_WIDTH_M + marginM && y >= -marginM && y <= COURT_LENGTH_M + marginM;
}
