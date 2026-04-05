import { useState, useRef, useCallback } from "react";
import { useConvex, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { uploadAndIndexVideo, pollUntilReady } from "../lib/twelvelabs/videoIndexer";
import { useMediaPipe } from "./useMediaPipe";
import type { AnalysisStatus } from "../types/playlog";

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

  const { analyzePose } = useMediaPipe();

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

          // MediaPipe: run pose estimation in-browser
          (async () => {
            const videoEl = document.createElement("video");
            videoEl.src = URL.createObjectURL(videoFile);
            videoEl.muted = true;
            await new Promise<void>((resolve, reject) => {
              videoEl.onloadedmetadata = () => resolve();
              videoEl.onerror = () => reject(new Error("Failed to load video for MediaPipe"));
            });

            await analyzePose(videoEl);
            URL.revokeObjectURL(videoEl.src);
            // Raw landmarks omitted — too large for Convex (>1 MiB).
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
      analyzePose,
    ]
  );

  return { status, error, sessionId, feedbackId, analyze };
}
