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
// classifyPhase
//
// Heuristically assigns a StrokePhase to a single frame based on:
//   - Wrist x position relative to hip (dominant side)
//   - Wrist y position relative to shoulder
//   - Hip-shoulder separation (coil indicator)
//
// This is a rule-based classifier, not ML. It works well for clear,
// unobstructed side-view footage. Frames that don't fit any rule
// return "unknown" and are excluded from scoring.
//
// Phase sequence assumed: preparation → backswing → forward_swing → impact
//                         → follow_through
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist    = lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const hip      = lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];
  const shoulder = lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const oppShoulder = lm[isRight ? L.LEFT_SHOULDER : L.RIGHT_SHOULDER];

  const leftHip  = lm[L.LEFT_HIP];
  const rightHip = lm[L.RIGHT_HIP];
  const leftShoulder  = lm[L.LEFT_SHOULDER];
  const rightShoulder = lm[L.RIGHT_SHOULDER];

  // Hip-shoulder separation: proxy for rotation/coil amount
  const hipAngle = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x);
  const shoulderAngle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  );
  const separation = Math.abs((shoulderAngle - hipAngle) * (180 / Math.PI));

  // Wrist behind hip on the dominant side → backswing territory
  const wristBehindHip = isRight
    ? wrist.x < hip.x
    : wrist.x > hip.x;

  // Wrist above shoulder → follow through (arm wrapped high)
  const wristAboveShoulder = wrist.y < shoulder.y;

  // Wrist crosses to opposite shoulder x → follow through complete
  const wristPastCenter = isRight
    ? wrist.x < oppShoulder.x
    : wrist.x > oppShoulder.x;

  // Wrist near hip height (within 10% of frame) → near contact
  const wristAtHipHeight = Math.abs(wrist.y - hip.y) < 0.10;

  if (wristBehindHip && separation < 15) return "preparation";
  if (wristBehindHip && separation >= 15) return "backswing";
  if (!wristBehindHip && !wristAboveShoulder && separation >= 30) return "forward_swing";
  if (!wristBehindHip && wristAtHipHeight && separation < 40) return "impact";
  if (wristAboveShoulder || wristPastCenter) return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// minVisibility
//
// Returns the minimum visibility score across all tennis-relevant landmarks
// in a frame. Used to discard frames where key joints are occluded.
// ---------------------------------------------------------------------------

function minVisibility(frame: ValidatedPoseFrame, dominantHand: "left" | "right"): number {
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
// Includes joint angles, positional booleans, ratios, and visibility.
// ---------------------------------------------------------------------------

function buildFrameMetrics(
  frame: ValidatedPoseFrame,
  phase: StrokePhase,
  dominantHand: "left" | "right",
  prevFrame: ValidatedPoseFrame | null,
): FrameMetrics {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist       = lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const hip         = lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];
  const oppShoulder = lm[isRight ? L.LEFT_SHOULDER  : L.RIGHT_SHOULDER];
  const frontAnkle = lm[isRight ? L.LEFT_ANKLE   : L.RIGHT_ANKLE]; // front foot = opposite side
  const backAnkle  = lm[isRight ? L.RIGHT_ANKLE  : L.LEFT_ANKLE];

  const angles = extractForehandAngles(normalizeLandmarks(lm), dominantHand);

  // Body height: nose y to ankle y (normalized coords)
  const nose = lm[L.NOSE];
  const bodyHeight = Math.abs(frontAnkle.y - nose.y) || 1;
  const contactHeightRatio = Math.max(0, Math.min(1, wrist.y / bodyHeight));

  // Wrist ahead of hip: in normalized space, positive x = racket-side
  const wristAheadOfHip = isRight ? wrist.x > hip.x : wrist.x < hip.x;

  // Follow-through complete: wrist y above opposite shoulder y
  const followThroughComplete = wrist.y < oppShoulder.y;

  // Weight on front foot: front ankle y is lower in the frame (larger y = lower)
  const weightOnFrontFoot = frontAnkle.y > backAnkle.y;

  // Hip rotation velocity: degrees per second between this and previous frame
  let hipRotationVelocity = 0;
  if (prevFrame) {
    const prevLm = prevFrame.landmarks;
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

    const deltaAngle = Math.abs(currHipAngle - prevHipAngle);
    const deltaSeconds = (frame.timestampMs - prevFrame.timestampMs) / 1000;
    hipRotationVelocity = deltaSeconds > 0 ? deltaAngle / deltaSeconds : 0;
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
// ScoredFrame — internal type combining metrics + score for aggregation
// ---------------------------------------------------------------------------

interface ScoredFrame {
  metrics: FrameMetrics;
  score: ForehandScore;
  phase: StrokePhase;
}

// ---------------------------------------------------------------------------
// scoreForehand
//
// Main entry point. Takes the full array of sampled frames from
// sampleVideoFrames(), classifies and scores each frame, selects one
// representative key frame per phase, and returns an AnalysisResult
// ready to send to Convex → Gemini.
//
// @param frames       - Output of sampleVideoFrames()
// @param fps          - The sampling rate used (for hipRotationVelocity calc)
// @param dominantHand - Player's hitting hand
// @param technique    - Stroke type (defaults to "forehand")
// ---------------------------------------------------------------------------

export function scoreForehand(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right",
  technique: TennisTechnique = "forehand"
): AnalysisResult {
  const allScored: ScoredFrame[] = [];
  let lowConfidenceFrames = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const confidence = minVisibility(frame, dominantHand);

    if (confidence < VISIBILITY_THRESHOLD) {
      lowConfidenceFrames++;
      continue;
    }

    const phase = classifyPhase(frame, dominantHand);
    if (phase === "unknown") continue;

    const metrics = buildFrameMetrics(
      frame,
      phase,
      dominantHand,
      i > 0 ? frames[i - 1] : null
    );

    const angles = extractForehandAngles(
      normalizeLandmarks(frame.landmarks),
      dominantHand
    );
    const score = compareToReference(angles, phase, technique);

    allScored.push({ metrics, score, phase });
  }

  // ── Select key frames ─────────────────────────────────────────────────────
  // One representative frame per phase: the frame with the highest overall
  // score within that phase (best form moment, not worst).
  const phaseOrder: StrokePhase[] = [
    "preparation",
    "backswing",
    "forward_swing",
    "impact",
    "follow_through",
  ];

  const keyFrames: FrameMetrics[] = [];
  const phaseScores: Partial<Record<StrokePhase, ForehandScore>> = {};

  for (const phase of phaseOrder) {
    const inPhase = allScored.filter((f) => f.phase === phase);
    if (inPhase.length === 0) continue;

    // Best-scoring frame = most representative of ideal technique in this phase
    const best = inPhase.reduce((a, b) =>
      a.score.overall >= b.score.overall ? a : b
    );

    keyFrames.push(best.metrics);
    phaseScores[phase] = best.score;
  }

  // ── Summary aggregation ───────────────────────────────────────────────────
  const impactFrames = allScored.filter((f) => f.phase === "impact");
  const loadFrames   = allScored.filter((f) => f.phase === "backswing");
  const allFrames    = allScored;

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgElbowAngleAtImpact = avg(
    impactFrames.map((f) => f.metrics.elbowAngle)
  );
  const avgKneeAngleAtLoad = avg(
    loadFrames.map((f) => f.metrics.kneeAngle)
  );
  const avgHipShoulderSeparation = avg(
    allFrames.map((f) => f.metrics.hipShoulderSeparation)
  );
  const followThroughFrames = allScored.filter((f) => f.phase === "follow_through");
  const followThroughCompletionRate =
    followThroughFrames.length > 0
      ? followThroughFrames.filter((f) => f.metrics.followThroughComplete).length /
        followThroughFrames.length
      : 0;

  const weightTransferDetected = allScored.some((f) => f.metrics.weightOnFrontFoot);

  return {
    sport: "tennis",
    technique,
    dominantHand,
    fps,
    totalFrames: frames.length,
    keyFrames,
    summary: {
      avgElbowAngleAtImpact: Math.round(avgElbowAngleAtImpact),
      avgKneeAngleAtLoad: Math.round(avgKneeAngleAtLoad),
      avgHipShoulderSeparation: Math.round(avgHipShoulderSeparation),
      followThroughCompletionRate: Math.round(followThroughCompletionRate * 100) / 100,
      weightTransferDetected,
      lowConfidenceFrames,
    },
  };
}
