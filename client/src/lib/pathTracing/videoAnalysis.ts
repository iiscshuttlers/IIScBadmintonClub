/**
 * Shuttlecock and Optical Motion Extraction
 * This utility uses frame-differencing to isolate small, fast-moving objects (shuttlecocks)
 * in badminton video feeds where the camera is primarily static.
 */

export interface ShuttlecockDetection {
  xPx: number;
  yPx: number;
  confidence: number;
}

export interface ShuttleSample {
  videoTimeMs: number;
  detection: ShuttlecockDetection | null;
}

// Reusable canvas contexts to avoid memory churn during extraction
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

const DOWNSAMPLE_RATIO = 0.5; // Downsample for performance

function getCanvas(width: number, height: number) {
  if (!offscreenCanvas || !offscreenCtx) {
    offscreenCanvas = document.createElement("canvas");
    offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
  }
  return { canvas: offscreenCanvas, ctx: offscreenCtx! };
}

/**
 * Extracts grayscale pixel data from the current video frame.
 */
export function extractGrayscaleFrame(video: HTMLVideoElement): Uint8ClampedArray {
  const w = Math.floor(video.videoWidth * DOWNSAMPLE_RATIO);
  const h = Math.floor(video.videoHeight * DOWNSAMPLE_RATIO);
  
  const { ctx } = getCanvas(w, h);
  ctx.drawImage(video, 0, 0, w, h);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const gray = new Uint8ClampedArray(w * h);
  
  // Convert RGBA to Grayscale
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  
  return gray;
}

/**
 * Analyzes the motion between the current frame and the previous frame
 * using Absolute Difference, thresholding, and centroid calculation.
 */
export function analyzeShuttleMotion(
  currentFrame: Uint8ClampedArray,
  prevFrame: Uint8ClampedArray,
  videoWidth: number,
  videoHeight: number
): ShuttlecockDetection | null {
  const w = Math.floor(videoWidth * DOWNSAMPLE_RATIO);
  const h = Math.floor(videoHeight * DOWNSAMPLE_RATIO);
  
  if (currentFrame.length !== prevFrame.length) return null;

  let sumX = 0;
  let sumY = 0;
  let motionPixels = 0;

  const DIFF_THRESHOLD = 30; // Min pixel intensity difference to be considered motion

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const diff = Math.abs(currentFrame[idx] - prevFrame[idx]);
      
      if (diff > DIFF_THRESHOLD) {
        sumX += x;
        sumY += y;
        motionPixels++;
      }
    }
  }

  // Filter out massive movement (like camera panning or huge player movements)
  // A shuttlecock is small. If there are too many motion pixels, it's noise.
  const maxAllowedMotionPixels = (w * h) * 0.05; // Max 5% of screen
  
  if (motionPixels === 0 || motionPixels > maxAllowedMotionPixels) {
    return null; // Too much noise or no motion
  }

  const centroidX = sumX / motionPixels;
  const centroidY = sumY / motionPixels;

  // Confidence based on how dense the moving pixels were (fewer pixels usually means higher confidence it's just the shuttle, not a player shadow)
  const confidence = Math.max(0, 1 - (motionPixels / maxAllowedMotionPixels));

  return {
    xPx: centroidX / DOWNSAMPLE_RATIO, // Upscale back to original video resolution
    yPx: centroidY / DOWNSAMPLE_RATIO,
    confidence
  };
}

export async function extractShuttlesForWindow(
  videoEl: HTMLVideoElement,
  windowMs: { startMs: number; endMs: number },
  sampleRateHz = 15,
  onProgress?: (donePct: number) => void,
): Promise<ShuttleSample[]> {
  const intervalMs = 1000 / sampleRateHz;
  const timestamps: number[] = [];
  for (let t = windowMs.startMs; t < windowMs.endMs; t += intervalMs) timestamps.push(Math.round(t));
  if (timestamps.length === 0) timestamps.push(Math.round(windowMs.startMs));

  const samples: ShuttleSample[] = [];
  let prevFrame: Uint8ClampedArray | null = null;

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    videoEl.currentTime = t / 1000;
    await new Promise((res) => { videoEl.onseeked = res; });

    const currentFrame = extractGrayscaleFrame(videoEl);
    let detection: ShuttlecockDetection | null = null;

    if (prevFrame) {
      detection = analyzeShuttleMotion(currentFrame, prevFrame, videoEl.videoWidth, videoEl.videoHeight);
    }

    samples.push({ videoTimeMs: t, detection });
    prevFrame = currentFrame;

    if (onProgress) onProgress((i + 1) / timestamps.length);
  }

  return samples;
}
