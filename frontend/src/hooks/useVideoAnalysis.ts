import { useState, useRef, useCallback } from "react";
import { api, useMutation, useAction, type Id } from "@/lib/api";
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

// Stored under a per-user key so multiple profiles on the same browser don't
// step on each other's "active" video. We only persist the session ID — the
// video URL is rehydrated on demand from R2 via api.storage.getSessionVideoUrl.
const ACTIVE_SESSION_KEY = (userId: string) => `playlog.activeSession.${userId}`;

export function useVideoAnalysis({
  userId,
  sport,
  requestedSections,
}: UseVideoAnalysisParams): UseVideoAnalysisResult {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionIdState] = useState<Id<"sessions"> | null>(() => {
    if (typeof window === "undefined") return null;
    return (window.localStorage.getItem(ACTIVE_SESSION_KEY(userId)) as Id<"sessions"> | null) ?? null;
  });
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<File | null>(null);
  const abortRef = useRef(false);

  // Mirror state writes through to localStorage so a reload (or a tab switch
  // that unmounts Learn) can rehydrate the active session.
  const setSessionId = useCallback(
    (id: Id<"sessions"> | null) => {
      setSessionIdState(id);
      if (typeof window === "undefined") return;
      if (id) window.localStorage.setItem(ACTIVE_SESSION_KEY(userId), id);
      else window.localStorage.removeItem(ACTIVE_SESSION_KEY(userId));
    },
    [userId]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setError(null);
    setSessionId(null);
    setFeedbackId(null);
    setCurrentVideo(null);
  }, [setSessionId]);

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createSession = useMutation(api.sessions.createSession);
  const createAnalysis = useMutation(api.analyses.createAnalysis);
  const updateAnalysis = useMutation(api.analyses.updateAnalysis);
  const analyzeDirect = useAction(api.twelvelabs.analyzeDirect);
  const generateFeedback = useAction(api.coach.generateFeedback);
  const checkAndAwardBadges = useMutation(api.badges.checkAndAwardBadges);

  const analyze = useCallback(
    async (videoFile: File) => {
      abortRef.current = false;
      setError(null);
      setFeedbackId(null);
      setSessionId(null);
      setCurrentVideo(videoFile);

      try {
        // ── Step 1: Upload to R2 via presigned PUT ────────────────────────────
        // The server returns a short-lived PUT URL; we send the bytes directly
        // to Cloudflare R2 (no proxy through our backend), then pass the
        // returned storageId into createSession.
        setStatus("uploading");

        const { uploadUrl, storageId } = await generateUploadUrl({
          contentType: videoFile.type || "video/mp4",
        });
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": videoFile.type || "video/mp4" },
          body: videoFile,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.statusText}`);
        }

        const newSessionId = await createSession({
          sport,
          videoStorageId: storageId,
          requestedSections,
        });
        setSessionId(newSessionId);

        const newAnalysisId = await createAnalysis({ sessionId: newSessionId });

        if (abortRef.current) return;

        // ── Step 2: Pegasus direct analysis ───────────────────────────────────
        // Single call — TwelveLabs pulls the video from R2 itself, runs
        // Pegasus, returns text. No more index/poll/analyze three-step dance.
        setStatus("analyzing");

        const prompt = `Analyze the ${sport} technique in this video. Focus on: ${requestedSections.join(", ")}.
Identify strengths, weaknesses, and specific drills to improve each area.`;

        await analyzeDirect({
          sessionId: newSessionId,
          analysisId: newAnalysisId,
          prompt,
        });

        if (abortRef.current) return;

        // ── Step 3: MediaPipe pose scoring ────────────────────────────────────
        // Runs BEFORE coach feedback so the server can build an authoritative
        // timeline (pose key-frames + Pegasus anchors) and ground Claude's
        // timestamps against it.
        setStatus("scoring");

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

        if (abortRef.current) return;

        // ── Step 4: Coach feedback (now grounded by pose timeline) ────────────
        const newFeedbackId = await generateFeedback({
          sessionId: newSessionId,
          analysisId: newAnalysisId,
        });

        setFeedbackId(newFeedbackId);

        // ── Step 5: Check and award badges ────────────────────────────────────
        await checkAndAwardBadges({});

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
      generateUploadUrl,
      createSession,
      createAnalysis,
      updateAnalysis,
      analyzeDirect,
      generateFeedback,
      checkAndAwardBadges,
    ]
  );

  return { status, error, sessionId, feedbackId, currentVideo, analyze, reset };
}
