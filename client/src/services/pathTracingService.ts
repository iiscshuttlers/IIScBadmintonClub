import { supabase } from "@/lib/supabase";
import type { Point2D } from "@/lib/pathTracing/homography";
import type { PathPoint } from "@/lib/pathTracing/speed";
import type { SyncAnchor } from "@/lib/pathTracing/sync";

export type MatchSource = "friendly" | "tournament" | "practice";

export interface CalibrationRow {
  id: string;
  match_id: string;
  match_source: MatchSource;
  court_width_m: number;
  court_length_m: number;
  src_points: Point2D[];
  dst_points: Point2D[];
  homography_matrix: number[][];
  video_frame_width: number;
  video_frame_height: number;
  sync_anchor_rally_number: number;
  sync_anchor_wallclock: string;
  sync_video_time_ms: number;
}

export interface PathRow {
  rally_number: number;
  side: "near" | "far";
  player_label: string | null;
  points: PathPoint[];
  sample_count: number;
  avg_speed_mps: number | null;
  peak_speed_mps: number | null;
  distance_covered_m: number | null;
}

export async function saveCalibration(input: {
  matchId: string;
  matchSource: MatchSource;
  srcPoints: [Point2D, Point2D, Point2D, Point2D];
  dstPoints: [Point2D, Point2D, Point2D, Point2D];
  homographyMatrix: number[][];
  videoFrameWidth: number;
  videoFrameHeight: number;
  syncAnchor: SyncAnchor;
  syncAnchorRallyNumber: number;
  userId: string | null;
}): Promise<{ id: string; homography: number[][] }> {
  const { data, error } = await supabase
    .from("match_video_calibration")
    .upsert(
      {
        match_id: input.matchId,
        match_source: input.matchSource,
        src_points: input.srcPoints,
        dst_points: input.dstPoints,
        homography_matrix: input.homographyMatrix,
        video_frame_width: input.videoFrameWidth,
        video_frame_height: input.videoFrameHeight,
        sync_anchor_rally_number: input.syncAnchorRallyNumber,
        sync_anchor_wallclock: input.syncAnchor.wallClockIso,
        sync_video_time_ms: input.syncAnchor.videoTimeMs,
        created_by: input.userId || null,
      } as any,
      { onConflict: "match_id,match_source" },
    )
    .select("id, homography_matrix")
    .single();

  if (error) throw error;
  return { id: data.id, homography: data.homography_matrix as number[][] };
}

export async function fetchCalibration(matchId: string, matchSource: MatchSource): Promise<CalibrationRow | null> {
  const { data, error } = await supabase
    .from("match_video_calibration")
    .select("*")
    .eq("match_id", matchId)
    .eq("match_source", matchSource)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as CalibrationRow | null;
}

export async function savePaths(input: {
  matchId: string;
  matchSource: MatchSource;
  calibrationId: string;
  userId: string | null;
  paths: Array<{ rally_number: number; side: "near" | "far" | "shuttle"; points: PathPoint[] }>;
}): Promise<void> {
  if (input.paths.length === 0) return;

  const rows = input.paths.map((p) => {
    const speeds = p.points.map((pt) => pt.speed_mps);
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    const peakSpeed = speeds.length ? Math.max(...speeds) : null;
    let distance = 0;
    for (let i = 1; i < p.points.length; i++) {
      const dx = p.points[i].x_m - p.points[i - 1].x_m;
      const dy = p.points[i].y_m - p.points[i - 1].y_m;
      distance += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      match_id: input.matchId,
      match_source: input.matchSource,
      rally_number: p.rally_number,
      side: p.side,
      points: p.points,
      sample_count: p.points.length,
      avg_speed_mps: avgSpeed,
      peak_speed_mps: peakSpeed,
      distance_covered_m: distance,
      calibration_id: input.calibrationId,
      processed_by: input.userId || null,
    };
  });

  const { error } = await supabase
    .from("match_player_paths")
    .upsert(rows as any, { onConflict: "match_id,match_source,rally_number,side" });

  if (error) throw error;
}

export async function fetchPaths(matchId: string, matchSource: MatchSource): Promise<PathRow[]> {
  const { data, error } = await supabase
    .from("match_player_paths")
    .select("rally_number, side, player_label, points, sample_count, avg_speed_mps, peak_speed_mps, distance_covered_m")
    .eq("match_id", matchId)
    .eq("match_source", matchSource)
    .order("rally_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PathRow[];
}
