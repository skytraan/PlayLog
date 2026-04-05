import { LandmarkIndex, type ValidatedPoseFrame, type AnalysisResult } from "../landmark-schema";
import { runScoringPipeline } from "../scorer-utils";
import { type StrokePhase } from "../reference-angles";

// ---------------------------------------------------------------------------
// classifyPhase — forehand
//
// Rule-based phase classifier using wrist position and hip-shoulder separation.
//
// Phase cues:
//   preparation   → wrist behind hip, minimal coil (<15°)
//   backswing     → wrist behind hip, coil building (≥15°)
//   forward_swing → wrist forward, arm not yet high, peak coil (≥30°)
//   impact        → wrist forward, at hip height, coil unwinding (<40°)
//   follow_through → wrist above shoulder or past center line
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist      = lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const hip        = lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];
  const shoulder   = lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const oppShoulder = lm[isRight ? L.LEFT_SHOULDER : L.RIGHT_SHOULDER];
  const leftHip    = lm[L.LEFT_HIP];
  const rightHip   = lm[L.RIGHT_HIP];
  const leftShoulder  = lm[L.LEFT_SHOULDER];
  const rightShoulder = lm[L.RIGHT_SHOULDER];

  const hipAngle = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x);
  const shoulderAngle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  );
  const separation = Math.abs((shoulderAngle - hipAngle) * (180 / Math.PI));

  const wristBehindHip    = isRight ? wrist.x < hip.x : wrist.x > hip.x;
  const wristAboveShoulder = wrist.y < shoulder.y;
  const wristPastCenter   = isRight ? wrist.x < oppShoulder.x : wrist.x > oppShoulder.x;
  const wristAtHipHeight  = Math.abs(wrist.y - hip.y) < 0.10;

  if (wristBehindHip && separation < 15)                              return "preparation";
  if (wristBehindHip && separation >= 15)                             return "backswing";
  if (!wristBehindHip && !wristAboveShoulder && separation >= 30)     return "forward_swing";
  if (!wristBehindHip && wristAtHipHeight && separation < 40)         return "impact";
  if (wristAboveShoulder || wristPastCenter)                          return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// scoreForehand
//
// Entry point for forehand analysis. Pass the output of sampleVideoFrames()
// and receive a scored AnalysisResult ready for Convex → Gemini.
// ---------------------------------------------------------------------------

export function scoreForehand(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right"
): AnalysisResult {
  return runScoringPipeline(frames, fps, dominantHand, "forehand", classifyPhase);
}
