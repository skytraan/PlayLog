import {
  LandmarkIndex,
  type ValidatedPoseFrame,
  type FrameMetrics,
  type AnalysisResult,
} from "./landmark-schema";
import { VISIBILITY_THRESHOLD } from "./pose-detector";
import {
  extractForehandAngles,
  normalizeLandmarks,
  compareToReference,
  type ForehandScore,
} from "./pose-utils";
import { type StrokePhase, type TennisTechnique } from "./reference-angles";

// ---------------------------------------------------------------------------
// ScoredFrame — internal type used across all technique scorers
// ---------------------------------------------------------------------------

export interface ScoredFrame {
  metrics: FrameMetrics;
  score: ForehandScore;
  phase: StrokePhase;
}

// ---------------------------------------------------------------------------
// PhaseClassifier — function signature each technique scorer provides
// ---------------------------------------------------------------------------

export type PhaseClassifier = (
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
) => StrokePhase;

// ---------------------------------------------------------------------------
// minVisibility
//
// Returns the minimum visibility score across all tennis-relevant landmarks.
// Used by every scorer to discard occluded frames before processing.
// ---------------------------------------------------------------------------

export function minVisibility(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): number {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const relevant = [
    lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER],
    lm[isRight ? L.RIGHT_ELBOW    : L.LEFT_ELBOW],
    lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST],
    lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP],
    lm[isRight ? L.RIGHT_KNEE     : L.LEFT_KNEE],
    lm[isRight ? L.RIGHT_ANKLE    : L.LEFT_ANKLE],
    lm[L.LEFT_HIP],
    lm[L.RIGHT_HIP],
    lm[L.LEFT_SHOULDER],
    lm[L.RIGHT_SHOULDER],
  ];

  return Math.min(...relevant.map((l) => l.visibility));
}

// ---------------------------------------------------------------------------
// buildFrameMetrics
//
// Derives the full FrameMetrics object from a single validated frame.
// Shared across all technique scorers — angles, booleans, ratios, velocity.
// ---------------------------------------------------------------------------

export function buildFrameMetrics(
  frame: ValidatedPoseFrame,
  phase: StrokePhase,
  dominantHand: "left" | "right",
  prevFrame: ValidatedPoseFrame | null
): FrameMetrics {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist       = lm[isRight ? L.RIGHT_WRIST   : L.LEFT_WRIST];
  const hip         = lm[isRight ? L.RIGHT_HIP     : L.LEFT_HIP];
  const oppShoulder = lm[isRight ? L.LEFT_SHOULDER : L.RIGHT_SHOULDER];
  const frontAnkle  = lm[isRight ? L.LEFT_ANKLE    : L.RIGHT_ANKLE];
  const backAnkle   = lm[isRight ? L.RIGHT_ANKLE   : L.LEFT_ANKLE];

  const angles = extractForehandAngles(normalizeLandmarks(lm), dominantHand);

  const nose = lm[L.NOSE];
  const bodyHeight = Math.abs(frontAnkle.y - nose.y) || 1;
  const contactHeightRatio = Math.max(0, Math.min(1, wrist.y / bodyHeight));

  const wristAheadOfHip     = isRight ? wrist.x > hip.x : wrist.x < hip.x;
  const followThroughComplete = wrist.y < oppShoulder.y;
  const weightOnFrontFoot   = frontAnkle.y > backAnkle.y;

  let hipRotationVelocity = 0;
  if (prevFrame) {
    const prevLm       = prevFrame.landmarks;
    const prevLeftHip  = prevLm[L.LEFT_HIP];
    const prevRightHip = prevLm[L.RIGHT_HIP];
    const currLeftHip  = lm[L.LEFT_HIP];
    const currRightHip = lm[L.RIGHT_HIP];

    const prevHipAngle = Math.atan2(
      prevRightHip.y - prevLeftHip.y,
      prevRightHip.x - prevLeftHip.x
    ) * (180 / Math.PI);

    const currHipAngle = Math.atan2(
      currRightHip.y - currLeftHip.y,
      currRightHip.x - currLeftHip.x
    ) * (180 / Math.PI);

    const deltaSeconds = (frame.timestampMs - prevFrame.timestampMs) / 1000;
    hipRotationVelocity =
      deltaSeconds > 0 ? Math.abs(currHipAngle - prevHipAngle) / deltaSeconds : 0;
  }

  return {
    timestampMs: frame.timestampMs,
    phase,
    elbowAngle: angles.elbowAngle,
    kneeAngle: angles.kneeAngle,
    hipShoulderSeparation: angles.hipShoulderSeparation,
    wristAheadOfHip,
    followThroughComplete,
    weightOnFrontFoot,
    contactHeightRatio,
    hipRotationVelocity,
    visibilityConfidence: minVisibility(frame, dominantHand),
  };
}

// ---------------------------------------------------------------------------
// runScoringPipeline
//
// The shared scoring loop used by every technique scorer.
// Each scorer provides its own PhaseClassifier — everything else is identical.
//
// @param frames       - Output of sampleVideoFrames()
// @param fps          - Sampling rate (stored in AnalysisResult)
// @param dominantHand - Player's hitting hand
// @param technique    - Which TechniqueConfig to score against
// @param classify     - Technique-specific phase classifier function
// ---------------------------------------------------------------------------

export function runScoringPipeline(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right",
  technique: TennisTechnique,
  classify: PhaseClassifier
): AnalysisResult {
  const allScored: ScoredFrame[] = [];
  let lowConfidenceFrames = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (minVisibility(frame, dominantHand) < VISIBILITY_THRESHOLD) {
      lowConfidenceFrames++;
      continue;
    }

    const phase = classify(frame, dominantHand);
    if (phase === "unknown") continue;

    const metrics = buildFrameMetrics(frame, phase, dominantHand, i > 0 ? frames[i - 1] : null);
    const angles  = extractForehandAngles(normalizeLandmarks(frame.landmarks), dominantHand);
    const score   = compareToReference(angles, phase, technique);

    allScored.push({ metrics, score, phase });
  }

  // ── Select key frames — best-scoring frame per phase ─────────────────────
  const phaseOrder: StrokePhase[] = [
    "preparation",
    "backswing",
    "forward_swing",
    "impact",
    "follow_through",
  ];

  const keyFrames: FrameMetrics[] = [];
  const keyScores: number[] = [];

  for (const phase of phaseOrder) {
    const inPhase = allScored.filter((f) => f.phase === phase);
    if (inPhase.length === 0) continue;
    const best = inPhase.reduce((a, b) => (a.score.overall >= b.score.overall ? a : b));
    keyFrames.push(best.metrics);
    keyScores.push(best.score.overall);
  }

  // ── Summary aggregation ───────────────────────────────────────────────────
  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const impactFrames        = allScored.filter((f) => f.phase === "impact");
  const loadFrames          = allScored.filter((f) => f.phase === "backswing");
  const followThroughFrames = allScored.filter((f) => f.phase === "follow_through");

  const followThroughCompletionRate =
    followThroughFrames.length > 0
      ? followThroughFrames.filter((f) => f.metrics.followThroughComplete).length /
        followThroughFrames.length
      : 0;

  const overallScore = keyScores.length > 0
    ? Math.round(keyScores.reduce((a, b) => a + b, 0) / keyScores.length)
    : 0;

  return {
    sport: "tennis",
    technique,
    dominantHand,
    fps,
    totalFrames: frames.length,
    keyFrames,
    overallScore,
    summary: {
      avgElbowAngleAtImpact:      Math.round(avg(impactFrames.map((f) => f.metrics.elbowAngle))),
      avgKneeAngleAtLoad:         Math.round(avg(loadFrames.map((f) => f.metrics.kneeAngle))),
      avgHipShoulderSeparation:   Math.round(avg(allScored.map((f) => f.metrics.hipShoulderSeparation))),
      followThroughCompletionRate: Math.round(followThroughCompletionRate * 100) / 100,
      weightTransferDetected:     allScored.some((f) => f.metrics.weightOnFrontFoot),
      lowConfidenceFrames,
    },
  };
}
