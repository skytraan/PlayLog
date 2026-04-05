import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { parseFirstPose, type ValidatedPoseFrame } from "./landmark-schema";

// ---------------------------------------------------------------------------
// Model config
// ---------------------------------------------------------------------------

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

// Minimum visibility confidence to consider a frame valid for scoring
export const VISIBILITY_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Singleton — model is heavy, only load once per page session
// ---------------------------------------------------------------------------

let _landmarker: PoseLandmarker | null = null;
let _initPromise: Promise<PoseLandmarker> | null = null;

/**
 * Loads the MediaPipe PoseLandmarker model once and caches it.
 * Safe to call multiple times — returns the same instance.
 */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  if (_landmarker) return _landmarker;

  // Deduplicate concurrent callers — don't load the model twice
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    _landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    return _landmarker;
  })();

  return _initPromise;
}

/**
 * Releases the landmarker and clears the cache.
 * Call this when the component using the detector unmounts.
 */
export function disposePoseLandmarker(): void {
  _landmarker?.close();
  _landmarker = null;
  _initPromise = null;
}

// ---------------------------------------------------------------------------
// Per-frame detection
// ---------------------------------------------------------------------------

/**
 * Runs pose detection on a single video frame.
 *
 * @param video       - The <video> element currently playing the clip
 * @param timestampMs - Current playback position in milliseconds
 * @returns A validated pose frame, or null if no person detected / low confidence
 */
export async function detectFromVideoFrame(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<ValidatedPoseFrame | null> {
  const landmarker = await initPoseLandmarker();

  // MediaPipe requires timestamps to be monotonically increasing
  const raw: PoseLandmarkerResult = landmarker.detectForVideo(video, timestampMs);

  return parseFirstPose({
    landmarks: raw.landmarks,
    worldLandmarks: raw.worldLandmarks,
    timestampMs,
  });
}

// ---------------------------------------------------------------------------
// Video sampling
// ---------------------------------------------------------------------------

/**
 * Samples frames from a video element at a fixed interval and runs detection
 * on each. Seeks the video to each timestamp and waits for the frame to render.
 *
 * @param video      - The <video> element (must be loaded and paused)
 * @param fps        - How many frames per second to sample (default 10)
 * @param onProgress - Optional callback with progress 0–1 as sampling runs
 * @returns Array of validated frames in timestamp order (null frames excluded)
 */
export async function sampleVideoFrames(
  video: HTMLVideoElement,
  fps = 10,
  onProgress?: (progress: number) => void,
  maxFrames = 15
): Promise<ValidatedPoseFrame[]> {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Video duration is not available — ensure the video is loaded.");
  }

  const intervalMs = 1000 / fps;
  const rawFrames = Math.floor((duration * 1000) / intervalMs);
  // Cap total frames to keep processing time bounded regardless of clip length
  const totalFrames = Math.min(rawFrames, maxFrames);
  const frames: ValidatedPoseFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = i * intervalMs;

    await seekVideo(video, timestampMs / 1000);

    const frame = await detectFromVideoFrame(video, timestampMs);
    if (frame !== null) frames.push(frame);

    onProgress?.(i / totalFrames);
  }

  onProgress?.(1);
  return frames;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Seeks a video to a given time in seconds and resolves when the frame
 * is ready to read (seeked event fires).
 */
function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error(`Video seek failed at ${timeSeconds}s`));
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = timeSeconds;
  });
}
