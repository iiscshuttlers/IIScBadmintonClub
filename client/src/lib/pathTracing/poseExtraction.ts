import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface RawPoseDetection {
  ankleMidpointPx: [number, number];
  visibility: number;
}

export interface RawPoseSample {
  videoTimeMs: number;
  detections: RawPoseDetection[];
}

const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const VISIBILITY_THRESHOLD = 0.5;

// Ankle landmarks sit near the court plane, so homography-projecting them
// introduces far less perspective error than hip-center (~0.9m above the
// court, whose apparent position shifts non-linearly with camera distance).
// Falls back to hip-center (at reduced confidence) when a foot is occluded,
// e.g. mid-lunge.
function extractCourtLandmark(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): RawPoseDetection | null {
  const la = landmarks[LEFT_ANKLE];
  const ra = landmarks[RIGHT_ANKLE];
  if (la.visibility >= VISIBILITY_THRESHOLD && ra.visibility >= VISIBILITY_THRESHOLD) {
    return {
      ankleMidpointPx: [((la.x + ra.x) / 2) * videoWidth, ((la.y + ra.y) / 2) * videoHeight],
      visibility: Math.min(la.visibility, ra.visibility),
    };
  }

  const lh = landmarks[LEFT_HIP];
  const rh = landmarks[RIGHT_HIP];
  if (lh.visibility >= VISIBILITY_THRESHOLD && rh.visibility >= VISIBILITY_THRESHOLD) {
    return {
      ankleMidpointPx: [((lh.x + rh.x) / 2) * videoWidth, ((lh.y + rh.y) / 2) * videoHeight],
      visibility: Math.min(lh.visibility, rh.visibility) * 0.7, // fallback proxy, lower confidence
    };
  }

  return null;
}

let landmarker: PoseLandmarker | null = null;
let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task",
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 2,
  });
}

async function getLandmarker(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker("GPU").catch((err) => {
      console.warn("MediaPipe GPU delegate failed to initialize, falling back to CPU", err);
      return createLandmarker("CPU");
    });
  }
  landmarker = await landmarkerPromise;
  return landmarker;
}

// MediaPipe's VIDEO running mode requires strictly increasing timestamps
// across detectForVideo() calls. Rallies must be processed in ascending
// video-time order within one landmarker session; call this before
// reprocessing an earlier rally out of order.
export async function resetLandmarker(): Promise<void> {
  if (landmarker) {
    landmarker.close();
    landmarker = null;
  }
  landmarkerPromise = null;
}

function seekVideo(videoEl: HTMLVideoElement, timeMs: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      // Some Android WebView versions fire `seeked` slightly before the frame
      // is actually decoded/paintable; a couple of rAF ticks lets it settle.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = timeMs / 1000;
  });
}

export async function extractPosesForWindow(
  videoEl: HTMLVideoElement,
  windowMs: { startMs: number; endMs: number },
  sampleRateHz = 5,
  onProgress?: (donePct: number) => void,
): Promise<RawPoseSample[]> {
  const lm = await getLandmarker();
  const intervalMs = 1000 / sampleRateHz;

  const timestamps: number[] = [];
  for (let t = windowMs.startMs; t < windowMs.endMs; t += intervalMs) timestamps.push(Math.round(t));
  if (timestamps.length === 0) timestamps.push(Math.round(windowMs.startMs));

  const samples: RawPoseSample[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    await seekVideo(videoEl, t);

    const result = lm.detectForVideo(videoEl, t);
    const detections: RawPoseDetection[] = [];
    for (const landmarks of result.landmarks) {
      const detection = extractCourtLandmark(landmarks, videoEl.videoWidth, videoEl.videoHeight);
      if (detection) detections.push(detection);
    }

    samples.push({ videoTimeMs: t, detections });
    onProgress?.((i + 1) / timestamps.length);
  }

  return samples;
}
