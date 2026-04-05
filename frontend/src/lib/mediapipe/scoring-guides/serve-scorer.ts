import { LandmarkIndex, type ValidatedPoseFrame, type AnalysisResult } from "../landmark-schema";
import { runScoringPipeline } from "../scorer-utils";
import { type StrokePhase } from "./reference-angles";

// ---------------------------------------------------------------------------
// classifyPhase — serve
//
// The serve has a fundamentally different shape from groundstrokes:
//   - No lateral wrist movement — arm goes overhead
//   - Deep knee bend followed by explosive upward extension
//   - Wrist ends up high above head at impact
//
// Phase cues:
//   preparation   → wrist below shoulder height, body upright (knee >160°)
//   backswing     → wrist dropping below hip (racket drop position), deep knee bend
//   forward_swing → wrist rising rapidly, arm driving upward, knee extending
//   impact        → wrist at or above head (above nose y), arm near full extension
//   follow_through → wrist dropping back down across body after contact
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist    = lm[isRight ? L.RIGHT_WRIST  : L.LEFT_WRIST];
  const elbow    = lm[isRight ? L.RIGHT_ELBOW  : L.LEFT_ELBOW];
  const shoulder = lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const hip      = lm[isRight ? L.RIGHT_HIP    : L.LEFT_HIP];
  const knee     = lm[isRight ? L.RIGHT_KNEE   : L.LEFT_KNEE];
  const ankle    = lm[isRight ? L.RIGHT_ANKLE  : L.LEFT_ANKLE];
  const nose     = lm[L.NOSE];

  // Knee angle proxy: compare knee y to hip and ankle (smaller gap = more bent)
  const kneeRelativelyBent = (knee.y - hip.y) < (ankle.y - knee.y) * 0.6;

  const wristBelowHip     = wrist.y > hip.y;
  const wristAboveShoulder = wrist.y < shoulder.y;
  const wristAboveHead    = wrist.y < nose.y;
  const elbowAboveShoulder = elbow.y < shoulder.y;

  // Wrist dropping back down after contact — past shoulder on the way down
  // and elbow is also below the peak
  const wristDescending = wristAboveShoulder && !wristAboveHead && !elbowAboveShoulder;

  if (!wristBelowHip && !wristAboveShoulder && !kneeRelativelyBent) return "preparation";
  if (wristBelowHip && kneeRelativelyBent)                           return "backswing";
  if (wristAboveShoulder && !wristAboveHead && elbowAboveShoulder)   return "forward_swing";
  if (wristAboveHead)                                                return "impact";
  if (wristDescending)                                               return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// scoreServe
// ---------------------------------------------------------------------------

export function scoreServe(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right"
): AnalysisResult {
  return runScoringPipeline(frames, fps, dominantHand, "serve", classifyPhase);
}
