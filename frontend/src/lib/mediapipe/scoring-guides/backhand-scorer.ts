import { LandmarkIndex, type ValidatedPoseFrame, type AnalysisResult } from "./landmark-schema";
import { runScoringPipeline } from "./scorer-utils";
import { type StrokePhase } from "./reference-angles";

// ---------------------------------------------------------------------------
// classifyPhase — one-handed backhand
//
// Key differences from forehand classifier:
//   - Arm crosses to the non-dominant side on backswing (opposite direction)
//   - Hip-shoulder separation is smaller — less coil needed
//   - Follow-through goes up on the same side (not across body)
//
// Phase cues:
//   preparation   → wrist on non-dominant side, neutral coil (<10°)
//   backswing     → wrist crossed to non-dominant side, coil building (≥10°)
//   forward_swing → wrist moving toward dominant side, coil unwinding (≥15°)
//   impact        → wrist forward of hip on dominant side, coil <25°
//   follow_through → wrist above shoulder on dominant side
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const wrist       = lm[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const hip         = lm[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];
  const shoulder    = lm[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const oppHip      = lm[isRight ? L.LEFT_HIP       : L.RIGHT_HIP];
  const leftHip     = lm[L.LEFT_HIP];
  const rightHip    = lm[L.RIGHT_HIP];
  const leftShoulder  = lm[L.LEFT_SHOULDER];
  const rightShoulder = lm[L.RIGHT_SHOULDER];

  const hipAngle = Math.atan2(rightHip.y - leftHip.y, rightHip.x - leftHip.x);
  const shoulderAngle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  );
  const separation = Math.abs((shoulderAngle - hipAngle) * (180 / Math.PI));

  // On a backhand, the wrist starts on the non-dominant side during prep/backswing
  const wristOnNonDomSide = isRight ? wrist.x < oppHip.x : wrist.x > oppHip.x;
  const wristAheadOfHip   = isRight ? wrist.x > hip.x    : wrist.x < hip.x;
  const wristAboveShoulder = wrist.y < shoulder.y;
  const wristAtHipHeight  = Math.abs(wrist.y - hip.y) < 0.10;

  if (wristOnNonDomSide && separation < 10)                       return "preparation";
  if (wristOnNonDomSide && separation >= 10)                      return "backswing";
  if (!wristOnNonDomSide && !wristAheadOfHip && separation >= 15) return "forward_swing";
  if (wristAheadOfHip && wristAtHipHeight && separation < 25)     return "impact";
  if (wristAboveShoulder)                                         return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// scoreBackhand
// ---------------------------------------------------------------------------

export function scoreBackhand(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right"
): AnalysisResult {
  return runScoringPipeline(frames, fps, dominantHand, "backhand_one_handed", classifyPhase);
}
