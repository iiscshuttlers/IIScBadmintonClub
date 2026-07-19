import { useEffect, useState } from "react";
import { Loader2, MapPin, ArrowLeftRight } from "lucide-react";
import { fetchPaths, type PathRow, type MatchSource } from "@/services/pathTracingService";
import { COURT_WIDTH_M, COURT_LENGTH_M, NET_Y_M } from "@/lib/pathTracing/court";
import { intensityColorHex } from "@/lib/intensityColor";
import { RallyBreakdown } from "@/components/player/RallyBreakdown";

const MAX_REFERENCE_SPEED_MPS = 6; // fixed reference so color scale is consistent across rallies
const SVG_WIDTH = 200;
const SVG_HEIGHT = (COURT_LENGTH_M / COURT_WIDTH_M) * SVG_WIDTH;

function toSvg(xM: number, yM: number): [number, number] {
  return [(xM / COURT_WIDTH_M) * SVG_WIDTH, (yM / COURT_LENGTH_M) * SVG_HEIGHT];
}

export function PathTraceViewer({ matchId, matchSource, hideIfEmpty }: { matchId: string; matchSource: MatchSource; hideIfEmpty?: boolean }) {
  const [paths, setPaths] = useState<PathRow[] | null>(null);
  const [selectedRally, setSelectedRally] = useState<number | null>(null);
  const [nearLabel, setNearLabel] = useState("Near court");
  const [farLabel, setFarLabel] = useState("Far court");

  useEffect(() => {
    let cancelled = false;
    fetchPaths(matchId, matchSource)
      .then((data) => {
        if (cancelled) return;
        setPaths(data);
        if (data.length > 0) setSelectedRally(data[0].rally_number);
      })
      .catch((err) => {
        console.error("Failed to load player paths", err);
        if (!cancelled) setPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, matchSource]);

  if (paths === null) {
    if (hideIfEmpty) return null;
    return (
      <div className="mt-4 flex items-center justify-center py-6 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading paths...
      </div>
    );
  }

  if (paths.length === 0) {
    if (hideIfEmpty) return null;
    return (
      <div className="mt-4 bg-slate-900 border border-slate-700/50 rounded-2xl p-4 text-center text-[11px] text-slate-400">
        No court path data for this match yet.
      </div>
    );
  }

  const rallyNumbers = Array.from(new Set(paths.map((p) => p.rally_number))).sort((a, b) => a - b);
  const rallyPaths = paths.filter((p) => p.rally_number === selectedRally);

  return (
    <div className="mt-4 bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-100 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-sky-400" /> Court Path
        </h4>
        <select
          value={selectedRally ?? ""}
          onChange={(e) => setSelectedRally(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-100"
        >
          {rallyNumbers.map((n) => (
            <option key={n} value={n}>
              Rally {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={nearLabel}
          onChange={(e) => setNearLabel(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-blue-300"
        />
        <button
          onClick={() => {
            const t = nearLabel;
            setNearLabel(farLabel);
            setFarLabel(t);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 shrink-0"
          title="Swap labels"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <input
          value={farLabel}
          onChange={(e) => setFarLabel(e.target.value)}
          className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-rose-300"
        />
      </div>

      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full rounded-xl bg-slate-950 border border-slate-800">
        <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} fill="none" stroke="#475569" strokeWidth={1} />
        <line
          x1={0}
          y1={(NET_Y_M / COURT_LENGTH_M) * SVG_HEIGHT}
          x2={SVG_WIDTH}
          y2={(NET_Y_M / COURT_LENGTH_M) * SVG_HEIGHT}
          stroke="#f43f5e"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {rallyPaths.map((p) =>
          p.points.slice(1).map((pt, i) => {
            const [x1, y1] = toSvg(p.points[i].x_m, p.points[i].y_m);
            const [x2, y2] = toSvg(pt.x_m, pt.y_m);
            const speedPct = Math.min(1, pt.speed_mps / MAX_REFERENCE_SPEED_MPS);
            return (
              <line
                key={`${p.side}-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={intensityColorHex(speedPct)}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          }),
        )}
      </svg>

      <p className="text-[9px] text-slate-500 mt-2">
        {nearLabel} (top) · {farLabel} (bottom) · color = speed (blue calm → amber moderate → rose explosive)
      </p>

      <RallyBreakdown matchId={matchId} matchSource={matchSource} />
    </div>
  );
}
