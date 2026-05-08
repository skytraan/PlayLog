import { LandmarkIndex, type ValidatedPoseFrame, type AnalysisResult } from "../landmark-schema";
import { runScoringPipeline } from "../scorer-utils";
import { type StrokePhase } from "../reference-angles";

// ---------------------------------------------------------------------------
// classifyPhase — footwork
//
// Footwork analysis focuses on lower body mechanics during court movement.
// We track the split step and lateral recovery cycle rather than arm path.
//
// Phase cues (one lateral movement cycle):
//   preparation   → split step — both feet off ground / landing with knee bend
//   backswing     → first lateral step / push-off from split step
//   forward_swing → acceleration phase — body moving toward ball
//   impact        → arrival stance — feet planted in hitting position
//   follow_through → recovery step — weight shifting back to center
//
// Heuristics use ankle symmetry (split step = ankles at same height),
// lateral hip displacement (movement direction), and knee bend depth.
// ---------------------------------------------------------------------------

function classifyPhase(
  frame: ValidatedPoseFrame,
  dominantHand: "left" | "right"
): StrokePhase {
  const L = LandmarkIndex;
  const lm = frame.landmarks;
  const isRight = dominantHand === "right";

  const leftAnkle  = lm[L.LEFT_ANKLE];
  const rightAnkle = lm[L.RIGHT_ANKLE];
  const leftKnee   = lm[L.LEFT_KNEE];
  const rightKnee  = lm[L.RIGHT_KNEE];
  const leftHip    = lm[L.LEFT_HIP];
  const rightHip   = lm[L.RIGHT_HIP];

  const domAnkle  = lm[isRight ? L.RIGHT_ANKLE : L.LEFT_ANKLE];
  const domKnee   = isRight ? rightKnee : leftKnee;
  const domHip    = lm[isRight ? L.RIGHT_HIP   : L.LEFT_HIP];
  const offAnkle  = lm[isRight ? L.LEFT_ANKLE  : L.RIGHT_ANKLE];
  const offKnee   = isRight ? leftKnee : rightKnee;
  const offHip    = lm[isRight ? L.LEFT_HIP    : L.RIGHT_HIP];

  // Ankle symmetry: split step = both ankles at nearly the same y height
  const ankleDiff = Math.abs(leftAnkle.y - rightAnkle.y);
  const splitStepSymmetry = ankleDiff < 0.05;

  // Bilateral knee bend: a real split-step lands with both knees bent.
  // Single-side bend on landing is a false-positive we previously accepted.
  const isBent = (knee: typeof domKnee, hip: typeof domHip, ankle: typeof domAnkle) =>
    Math.abs(knee.y - hip.y) < Math.abs(ankle.y - hip.y) * 0.45;
  const deepKneeBend = isBent(domKnee, domHip, domAnkle);
  const bothKneesBent = deepKneeBend && isBent(offKnee, offHip, offAnkle);

  // Hip lateral displacement: is the body shifted toward the dominant side
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const bodyShiftedToDomSide = isRight ? hipMidX > 0.5 : hipMidX < 0.5;

  // Front foot placement: dominant side foot is ahead of off-side foot
  const domFootAhead = isRight ? domAnkle.x > offAnkle.x : domAnkle.x < offAnkle.x;

  // Feet wide apart = arrival stance or recovery
  const feetWidth = Math.abs(leftAnkle.x - rightAnkle.x);
  const wideStance = feetWidth > 0.25;

  if (splitStepSymmetry && bothKneesBent)            return "preparation";
  if (!splitStepSymmetry && deepKneeBend && !wideStance) return "backswing";
  if (!splitStepSymmetry && bodyShiftedToDomSide && !wideStance) return "forward_swing";
  if (wideStance && domFootAhead)                    return "impact";
  if (wideStance && !domFootAhead)                   return "follow_through";

  return "unknown";
}

// ---------------------------------------------------------------------------
// scoreFootwork
// ---------------------------------------------------------------------------

export function scoreFootwork(
  frames: ValidatedPoseFrame[],
  fps: number,
  dominantHand: "left" | "right" = "right"
): AnalysisResult {
  return runScoringPipeline(frames, fps, dominantHand, "footwork", classifyPhase);
}
