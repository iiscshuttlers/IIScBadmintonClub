// Shared 0-1 intensity/speed color scale: blue (calm) -> amber (moderate) -> rose (explosive).
// Used by RallyBreakdown's duration bars and the path-tracing speed-colored trails.

export function intensityColor(pct: number): string {
  if (pct < 0.4) return "bg-blue-500";
  if (pct < 0.75) return "bg-amber-500";
  return "bg-rose-500";
}

export function intensityColorHex(pct: number): string {
  if (pct < 0.4) return "#3b82f6";
  if (pct < 0.75) return "#f59e0b";
  return "#f43f5e";
}
