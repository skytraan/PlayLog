import { useState, useRef, useCallback } from "react";
import { useConvex, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { uploadAndIndexVideo, pollUntilReady } from "../lib/twelvelabs/videoIndexer";
import { sampleVideoFrames, disposePoseLandmarker } from "../lib/mediapipe/pose-detector";
import { scoreForehand } from "../lib/mediapipe/scoring-guides/forehand-scorer";
import { scoreBackhand } from "../lib/mediapipe/scoring-guides/backhand-scorer";
import { scoreServe } from "../lib/mediapipe/scoring-guides/serve-scorer";
import { scoreVolley } from "../lib/mediapipe/scoring-guides/volley-scorer";
import { scoreFootwork } from "../lib/mediapipe/scoring-guides/footwork-scorer";
import type { ValidatedPoseFrame } from "../lib/mediapipe/landmark-schema";
import type { AnalysisStatus } from "../types/playlog";

type Scorer = (frames: ValidatedPoseFrame[], fps: number, dominantHand: "left" | "right") => ReturnType<typeof scoreForehand>;

const TECHNIQUE_SCORERS: Array<{ keyword: string; scorer: Scorer }> = [
  { keyword: "backhand", scorer: scoreBackhand },
  { keyword: "serve",    scorer: scoreServe },
  { keyword: "volley",   scorer: scoreVolley },
  { keyword: "footwork", scorer: scoreFootwork },
  { keyword: "forehand", scorer: scoreForehand },
];

function pickScorers(sections: string[]): Scorer[] {
  const matched: Scorer[] = [];
  for (const section of sections) {
    const lower = section.toLowerCase();
    const entry = TECHNIQUE_SCORERS.find((t) => lower.includes(t.keyword));
    if (entry && !matched.includes(entry.scorer)) matched.push(entry.scorer);
  }
  return matched.length > 0 ? matched : [scoreForehand];
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
  currentVideo: File | null;
  analyze: (videoFile: File) => Promise<void>;
  reset: () => void;
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
  const [currentVideo, setCurrentVideo] = useState<File | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setError(null);
    setSessionId(null);
    setFeedbackId(null);
    setCurrentVideo(null);
  }, []);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);
  const createAnalysis = useMutation(api.analyses.createAnalysis);
  const updateAnalysis = useMutation(api.analyses.updateAnalysis);
  const analyzeVideo = useAction(api.twelvelabs.analyzeVideo);
  const generateFeedback = useAction(api.gemini.generateFeedback);
  const checkAndAwardBadges = useMutation(api.badges.checkAndAwardBadges);

  const analyze = useCallback(
    async (videoFile: File) => {
      abortRef.current = false;
      setError(null);
      setFeedbackId(null);
      setSessionId(null);
      setCurrentVideo(videoFile);

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

        // ── Step 2: TwelveLabs indexing ───────────────────────────────────────
        setStatus("analyzing");

        const indexResult = await uploadAndIndexVideo(convex, {
          sessionId: newSessionId,
          analysisId: newAnalysisId,
          sport,
        });

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

        if (abortRef.current) return;

        // ── Step 6: MediaPipe pose scoring (after Gemini) ─────────────────────
        disposePoseLandmarker();
        const videoEl = document.createElement("video");
        videoEl.src = URL.createObjectURL(videoFile);
        videoEl.muted = true;
        await new Promise<void>((resolve, reject) => {
          videoEl.onloadedmetadata = () => resolve();
          videoEl.onerror = () => reject(new Error("Failed to load video for MediaPipe"));
        });

        const frames = await sampleVideoFrames(videoEl, 2);
        URL.revokeObjectURL(videoEl.src);

        if (frames.length > 0) {
          const scorers = pickScorers(requestedSections);
          const poseResults = scorers.map((scorer) => scorer(frames, 2, "right"));
          const overallScore = Math.round(
            poseResults.reduce((s, r) => s + r.overallScore, 0) / poseResults.length
          );
          await updateAnalysis({
            analysisId: newAnalysisId,
            poseAnalysis: JSON.stringify(poseResults),
            overallScore,
            technique: poseResults.map((r) => r.technique).join(","),
          });
        }

        // ── Step 7: Check and award badges ────────────────────────────────────
        await checkAndAwardBadges({ userId });

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
      checkAndAwardBadges,
    ]
  );

  return { status, error, sessionId, feedbackId, currentVideo, analyze, reset };
}
