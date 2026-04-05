import { LandmarkIndex, type ValidatedPoseFrame, type AnalysisResult } from "../landmark-schema";
import { runScoringPipeline } from "../scorer-utils";
import { type StrokePhase } from "./reference-angles";

// ---------------------------------------------------------------------------
// classifyPhase — volley
//
// The volley is compact — phases are shorter and arm movement is minimal.
// Key characteristics:
//   - Elbow stays in front of body throughout (no wrap-around)
//   - Wrist stays above hip height at all times
//   - No large hip-shoulder separation
//   - Follow-through is short and firm, not a full wrap
//
// Phase cues:
//   preparation   → wrist at chest height (between hip and shoulder), centered
//   backswing     → wrist slightly behind shoulder line (compact unit turn)
//   forward_swing → wrist moving forward, still above hip
//   impact        → wrist in front of body, above hip, forward of shoulder
//   follow_through → wrist slightly past contact point, arm firms up (short finish)
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist    = lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const elbow    = lm[isRight ? L.RIGHT_ELBOW    : L.LEFT_ELBOW];
  const shoulder = lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const hip      = lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];

  const wristAboveHip      = wrist.y < hip.y;
  const wristBelowShoulder = wrist.y > shoulder.y;
  const wristAtChestHeight = wristAboveHip && wristBelowShoulder;

  // Wrist behind the elbow x = compact backswing position
  const wristBehindElbow = isRight ? wrist.x < elbow.x : wrist.x > elbow.x;

  // Wrist ahead of shoulder = punching through contact
  const wristAheadOfShoulder = isRight ? wrist.x > shoulder.x : wrist.x < shoulder.x;

  if (wristAtChestHeight && !wristBehindElbow && !wristAheadOfShoulder) return "preparation";
  if (wristAtChestHeight && wristBehindElbow)                           return "backswing";
  if (wristAboveHip && !wristBehindElbow && !wristAheadOfShoulder)     return "forward_swing";
  if (wristAheadOfShoulder && wristAboveHip && wristBelowShoulder)     return "impact";
  if (wristAheadOfShoulder && wristAboveHip)                           return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// scoreVolley
// ---------------------------------------------------------------------------

export function scoreVolley(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right"
): AnalysisResult {
  return runScoringPipeline(frames, fps, dominantHand, "volley", classifyPhase);
}
