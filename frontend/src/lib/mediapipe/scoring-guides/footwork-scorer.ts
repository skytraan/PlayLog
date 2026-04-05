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
  const domKnee   = lm[isRight ? L.RIGHT_KNEE  : L.LEFT_KNEE];
  const domHip    = lm[isRight ? L.RIGHT_HIP   : L.LEFT_HIP];
  const offAnkle  = lm[isRight ? L.LEFT_ANKLE  : L.RIGHT_ANKLE];

  // Ankle symmetry: split step = both ankles at nearly the same y height
  const ankleDiff = Math.abs(leftAnkle.y - rightAnkle.y);
  const splitStepSymmetry = ankleDiff < 0.05;

  // Knee bend depth: compare knee y gap to hip-ankle span
  const kneeSpan = Math.abs(domKnee.y - domHip.y);
  const legSpan  = Math.abs(domAnkle.y - domHip.y);
  const deepKneeBend = kneeSpan < legSpan * 0.45; // knee is high relative to leg = bent

  // Hip lateral displacement: is the body shifted toward the dominant side
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const bodyShiftedToDomSide = isRight ? hipMidX > 0.5 : hipMidX < 0.5;

  // Front foot placement: dominant side foot is ahead of off-side foot
  const domFootAhead = isRight ? domAnkle.x > offAnkle.x : domAnkle.x < offAnkle.x;

  // Feet wide apart = arrival stance or recovery
  const feetWidth = Math.abs(leftAnkle.x - rightAnkle.x);
  const wideStance = feetWidth > 0.25;

  if (splitStepSymmetry && deepKneeBend)             return "preparation";
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
