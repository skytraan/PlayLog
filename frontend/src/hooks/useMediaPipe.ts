import { useState, useRef, useCallback } from "react";
import type { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface UseMediaPipeResult {
  loading: boolean;
  error: string | null;
  analyzePose: (videoEl: HTMLVideoElement) => Promise<PoseLandmark[][]>;
}

export function useMediaPipe(): UseMediaPipeResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const ensureModel = useCallback(async (): Promise<PoseLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    setLoading(true);
    setError(null);

    try {
      const vision = await (
        await import("@mediapipe/tasks-vision")
      ).FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      const { PoseLandmarker } = await import("@mediapipe/tasks-vision");

      const landmarker = await PoseLandmarker.createFromOptions(vision as FilesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (err) {
      const msg = `Failed to load MediaPipe model: ${String(err)}`;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzePose = useCallback(
    async (videoEl: HTMLVideoElement): Promise<PoseLandmark[][]> => {
      const landmarker = await ensureModel();

      const allFrameLandmarks: PoseLandmark[][] = [];
      const duration = videoEl.duration;
      const fps = 5; // sample 5 frames per second
      const frameCount = Math.floor(duration * fps);

      for (let i = 0; i < frameCount; i++) {
        const timestampMs = (i / fps) * 1000;
        videoEl.currentTime = i / fps;

        // wait for seek to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            videoEl.removeEventListener("seeked", onSeeked);
            resolve();
          };
          videoEl.addEventListener("seeked", onSeeked);
        });

        const result = landmarker.detectForVideo(videoEl, timestampMs);
        if (result.landmarks.length > 0) {
          allFrameLandmarks.push(
            result.landmarks[0].map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility ?? 0,
            }))
          );
        }
      }

      return allFrameLandmarks;
    },
    [ensureModel]
  );

  return { loading, error, analyzePose };
}
