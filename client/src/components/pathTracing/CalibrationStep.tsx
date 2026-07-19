import { useEffect, useRef, useState } from "react";
import { RotateCcw, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { computeHomography, applyHomography, invertHomography, type Point2D } from "@/lib/pathTracing/homography";
import { CANONICAL_COURT_CORNERS, COURT_WIDTH_M, NET_Y_M } from "@/lib/pathTracing/court";

const CORNER_LABELS = ["Near-Left corner", "Near-Right corner", "Far-Right corner", "Far-Left corner"];

export function CalibrationStep({
  videoRef,
  videoWidth,
  videoHeight,
  onConfirm,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoWidth: number;
  videoHeight: number;
  onConfirm: (result: { srcPoints: [Point2D, Point2D, Point2D, Point2D]; homography: number[][] }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point2D[]>([]);
  const [homography, setHomography] = useState<number[][] | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // tapped corner markers
    points.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, y);
    });

    // reprojected court outline, for visual confirmation the fit lines up
    if (homography) {
      try {
        const Hinv = invertHomography(homography);
        const toPx = (p: Point2D) => applyHomography(Hinv, p);
        const corners = CANONICAL_COURT_CORNERS.map(toPx);
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]);
        corners.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.stroke();

        const netLeft = toPx([0, NET_Y_M]);
        const netRight = toPx([COURT_WIDTH_M, NET_Y_M]);
        ctx.beginPath();
        ctx.moveTo(netLeft[0], netLeft[1]);
        ctx.lineTo(netRight[0], netRight[1]);
        ctx.strokeStyle = "#f43f5e";
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } catch {
        // singular homography from nearly-collinear taps; ignore overlay this frame
      }
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.readyState >= 2) {
      draw();
    }

    const onData = () => draw();
    video.addEventListener("loadeddata", onData);
    video.addEventListener("seeked", onData);
    video.addEventListener("timeupdate", onData);

    // Force a tiny seek to ensure the first frame is decoded
    if (video.currentTime === 0) {
      video.currentTime = 0.001;
    }

    return () => {
      video.removeEventListener("loadeddata", onData);
      video.removeEventListener("seeked", onData);
      video.removeEventListener("timeupdate", onData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, homography, videoWidth, videoHeight]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length >= 4) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const next = [...points, [x, y] as Point2D];
    setPoints(next);
    if (next.length === 4) {
      try {
        setHomography(computeHomography(next as [Point2D, Point2D, Point2D, Point2D], CANONICAL_COURT_CORNERS));
      } catch {
        setHomography(null);
      }
    }
  };

  const undoLast = () => {
    setPoints(points.slice(0, -1));
    setHomography(null);
  };

  const scrubFrame = (deltaSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + deltaSec));
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      draw();
    };
    video.addEventListener("seeked", onSeeked);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
      <h3 className="text-sm font-black text-slate-100 mb-1">Calibrate Court</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        {points.length < 4
          ? `Tap the court's ${CORNER_LABELS[points.length]} on the frame below.`
          : "Confirm the green outline lines up with the painted court lines."}
      </p>

      <div className="flex items-center justify-center gap-2 mb-2">
        <button onClick={() => scrubFrame(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-slate-500 font-bold">scrub to a clearer frame</span>
        <button onClick={() => scrubFrame(1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-700">
        <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full h-auto block cursor-crosshair" />
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={undoLast}
          disabled={points.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-200 disabled:opacity-40 border border-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Undo point
        </button>
        <button
          onClick={() => homography && onConfirm({ srcPoints: points as [Point2D, Point2D, Point2D, Point2D], homography })}
          disabled={!homography}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-primary/20 text-primary border border-primary/30 disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" /> Confirm calibration
        </button>
      </div>
    </div>
  );
}
