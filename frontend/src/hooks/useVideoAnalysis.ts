import { useState, useRef, useCallback } from "react";
import { useConvex, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { uploadAndIndexVideo, pollUntilReady } from "../lib/twelvelabs/videoIndexer";
import { sampleVideoFrames } from "../lib/mediapipe/pose-detector";
import { scoreForehand } from "../lib/mediapipe/scoring-guides/forehand-scorer";
import { scoreBackhand } from "../lib/mediapipe/scoring-guides/backhand-scorer";
import { scoreServe } from "../lib/mediapipe/scoring-guides/serve-scorer";
import { scoreVolley } from "../lib/mediapipe/scoring-guides/volley-scorer";
import { scoreFootwork } from "../lib/mediapipe/scoring-guides/footwork-scorer";
import type { ValidatedPoseFrame } from "../lib/mediapipe/landmark-schema";
import type { AnalysisStatus } from "../types/playlog";

type Scorer = (frames: ValidatedPoseFrame[], fps: number, dominantHand: "left" | "right") => ReturnType<typeof scoreForehand>;

function pickScorer(sections: string[]): Scorer {
  const first = (sections[0] ?? "").toLowerCase();
  if (first.includes("backhand")) return scoreBackhand;
  if (first.includes("serve")) return scoreServe;
  if (first.includes("volley")) return scoreVolley;
  if (first.includes("footwork")) return scoreFootwork;
  return scoreForehand;
}

interface UseVideoAnalysisParams {
  userId: Id<"users">;
  sport: string;
  requestedSections: string[];
}

interface UseVideoAnalysisResult {
  status: AnalysisStatus;
  error: string | null;
  sessionId: Id<"sessions"> | null;
  feedbackId: string | null;
  analyze: (videoFile: File) => Promise<void>;
}

export function useVideoAnalysis({
  userId,
  sport,
  requestedSections,
}: UseVideoAnalysisParams): UseVideoAnalysisResult {
  const convex = useConvex();
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);
  const createAnalysis = useMutation(api.analyses.createAnalysis);
  const updateAnalysis = useMutation(api.analyses.updateAnalysis);
  const analyzeVideo = useAction(api.twelvelabs.analyzeVideo);
  const generateFeedback = useAction(api.gemini.generateFeedback);

  const analyze = useCallback(
    async (videoFile: File) => {
      abortRef.current = false;
      setError(null);
      setFeedbackId(null);
      setSessionId(null);

      try {
        // ── Step 1: Upload to Convex storage ──────────────────────────────────
        setStatus("uploading");

        const uploadUrl = await generateUploadUrl({});
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": videoFile.type },
          body: videoFile,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.statusText}`);
        }

        const { storageId } = await uploadRes.json() as { storageId: Id<"_storage"> };

        const newSessionId = await createSession({
          userId,
          sport,
          videoStorageId: storageId,
          requestedSections,
        });
        setSessionId(newSessionId);

        const newAnalysisId = await createAnalysis({ sessionId: newSessionId });

        if (abortRef.current) return;

        // ── Step 2: TwelveLabs indexing + MediaPipe in parallel ───────────────
        setStatus("analyzing");

        const videoBlob = new Blob([videoFile], { type: videoFile.type });

        const [indexResult] = await Promise.all([
          // TwelveLabs: upload blob → index
          uploadAndIndexVideo(convex, {
            videoBlob,
            sessionId: newSessionId,
            analysisId: newAnalysisId,
            sport,
          }),

          // MediaPipe: sample frames, score technique, persist computed result
          (async () => {
            const videoEl = document.createElement("video");
            videoEl.src = URL.createObjectURL(videoFile);
            videoEl.muted = true;
            await new Promise<void>((resolve, reject) => {
              videoEl.onloadedmetadata = () => resolve();
              videoEl.onerror = () => reject(new Error("Failed to load video for MediaPipe"));
            });

            const frames = await sampleVideoFrames(videoEl, 5);
            URL.revokeObjectURL(videoEl.src);

            if (frames.length > 0) {
              const scorer = pickScorer(requestedSections);
              const poseResult = scorer(frames, 5, "right");
              await updateAnalysis({
                analysisId: newAnalysisId,
                poseAnalysis: JSON.stringify(poseResult),
              });
            }
          })(),
        ]);

        if (abortRef.current) return;

        // ── Step 3: Poll until TwelveLabs indexing is done ────────────────────
        const pollResult = await pollUntilReady(convex, {
          taskId: indexResult.taskId,
          sessionId: newSessionId,
          analysisId: newAnalysisId,
        });

        if (pollResult.status === "failed") {
          throw new Error("TwelveLabs indexing failed");
        }

        if (abortRef.current) return;

        // ── Step 4: Pegasus prompt analysis ───────────────────────────────────
        const prompt = `Analyze the ${sport} technique in this video. Focus on: ${requestedSections.join(", ")}.
Identify strengths, weaknesses, and specific drills to improve each area.`;

        await analyzeVideo({
          analysisId: newAnalysisId,
          videoId: pollResult.videoId!,
          prompt,
        });

        if (abortRef.current) return;

        // ── Step 5: Gemini coaching feedback ──────────────────────────────────
        setStatus("scoring");

        const newFeedbackId = await generateFeedback({
          sessionId: newSessionId,
          analysisId: newAnalysisId,
        });

        setFeedbackId(newFeedbackId);
        setStatus("ready");
      } catch (err) {
        if (abortRef.current) return;
        const msg = err instanceof Error ? err.message : "Analysis failed";
        setError(msg);
        setStatus("error");
      }
    },
    [
      userId,
      sport,
      requestedSections,
      convex,
      generateUploadUrl,
      createSession,
      createAnalysis,
      updateAnalysis,
      analyzeVideo,
      generateFeedback,
    ]
  );

  return { status, error, sessionId, feedbackId, analyze };
}
