import { LandmarkIndex, type Landmark, type PoseLandmarks } from "./landmark-schema";

// ---------------------------------------------------------------------------
// calcAngle
//
// Computes the interior angle (in degrees) at joint B, formed by the vectors
// B→A and B→C.
//
// Uses the 2D dot product of the two vectors — ignores z depth so the
// result is stable even when z confidence is low.
//
// Example usage:
//   calcAngle(
//     landmarks[LandmarkIndex.RIGHT_SHOULDER],  // a
//     landmarks[LandmarkIndex.RIGHT_ELBOW],     // b (vertex)
//     landmarks[LandmarkIndex.RIGHT_WRIST],     // c
//   )
//   → elbow angle in degrees
// ---------------------------------------------------------------------------

export function calcAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const dot = ba.x * bc.x + ba.y * bc.y;
  const mag = Math.sqrt(ba.x ** 2 + ba.y ** 2) * Math.sqrt(bc.x ** 2 + bc.y ** 2);

  // Guard against division by zero when two landmarks are at the same point
  if (mag === 0) return 0;

  // Clamp to [-1, 1] before acos to absorb floating-point rounding errors
  const clamped = Math.max(-1, Math.min(1, dot / mag));

  return Math.round((Math.acos(clamped) * 180) / Math.PI);
}

// ---------------------------------------------------------------------------
// ForehandAngles
//
// The 6 joint angles extracted from a single pose frame that matter for
// scoring a tennis forehand. These feed directly into FrameMetrics.
// ---------------------------------------------------------------------------

export interface ForehandAngles {
  /** Hitting arm: shoulder → elbow → wrist */
  elbowAngle: number;
  /** Hitting shoulder elevation: ear → shoulder → elbow */
  shoulderAngle: number;
  /** Front leg load: hip → knee → ankle */
  kneeAngle: number;
  /** Rotation gap between hip axis and shoulder axis (degrees) */
  hipShoulderSeparation: number;
  /** Wrist extension: elbow → wrist → index finger */
  wristAngle: number;
  /** Lateral trunk lean: shoulder midpoint → hip midpoint vs vertical */
  trunkLean: number;
}

// ---------------------------------------------------------------------------
// extractForehandAngles
//
// Pulls all 6 forehand-relevant angles from a full 33-landmark pose in one
// pass. Handles left/right dominant hand by mirroring the landmark indices.
// ---------------------------------------------------------------------------

export function extractForehandAngles(
  landmarks: PoseLandmarks,
  dominantHand: "left" | "right" = "right"
): ForehandAngles {
  const L = LandmarkIndex;
  const isRight = dominantHand === "right";

  // Dominant-side indices
  const ear      = landmarks[isRight ? L.RIGHT_EAR      : L.LEFT_EAR];
  const shoulder = landmarks[isRight ? L.RIGHT_SHOULDER : L.LEFT_SHOULDER];
  const elbow    = landmarks[isRight ? L.RIGHT_ELBOW    : L.LEFT_ELBOW];
  const wrist    = landmarks[isRight ? L.RIGHT_WRIST    : L.LEFT_WRIST];
  const index    = landmarks[isRight ? L.RIGHT_INDEX    : L.LEFT_INDEX];
  const hip      = landmarks[isRight ? L.RIGHT_HIP      : L.LEFT_HIP];
  const knee     = landmarks[isRight ? L.RIGHT_KNEE     : L.LEFT_KNEE];
  const ankle    = landmarks[isRight ? L.RIGHT_ANKLE    : L.LEFT_ANKLE];

  // Both sides for separation + trunk lean
  const leftShoulder  = landmarks[L.LEFT_SHOULDER];
  const rightShoulder = landmarks[L.RIGHT_SHOULDER];
  const leftHip       = landmarks[L.LEFT_HIP];
  const rightHip      = landmarks[L.RIGHT_HIP];

  return {
    elbowAngle:   calcAngle(shoulder, elbow, wrist),
    shoulderAngle: calcAngle(ear, shoulder, elbow),
    kneeAngle:    calcAngle(hip, knee, ankle),
    wristAngle:   calcAngle(elbow, wrist, index),

    hipShoulderSeparation: calcAxisSeparation(
      leftHip, rightHip,
      leftShoulder, rightShoulder
    ),

    trunkLean: calcTrunkLean(leftShoulder, rightShoulder, leftHip, rightHip),
  };
}

// ---------------------------------------------------------------------------
// Internal: axis separation
//
// Computes the angle (degrees) between the hip axis and shoulder axis.
// A separation of ~45° is typical at forehand contact — more = coiled,
// less = flat/arms-only swing.
// ---------------------------------------------------------------------------

function calcAxisSeparation(
  leftHip: Landmark, rightHip: Landmark,
  leftShoulder: Landmark, rightShoulder: Landmark
): number {
  const hipAngle = Math.atan2(
    rightHip.y - leftHip.y,
    rightHip.x - leftHip.x
  );
  const shoulderAngle = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  );
  return Math.round(Math.abs((shoulderAngle - hipAngle) * (180 / Math.PI)));
}

// ---------------------------------------------------------------------------
// Internal: trunk lean
//
// Lateral tilt of the torso — angle between the vertical and the line
// connecting the shoulder midpoint to the hip midpoint.
// 0° = upright, positive = leaning toward the camera-right side.
// ---------------------------------------------------------------------------

function calcTrunkLean(
  leftShoulder: Landmark, rightShoulder: Landmark,
  leftHip: Landmark, rightHip: Landmark
): number {
  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMid = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  // Angle of torso line from vertical (straight up = 0°)
  const dx = shoulderMid.x - hipMid.x;
  const dy = shoulderMid.y - hipMid.y;
  return Math.round(Math.atan2(dx, -dy) * (180 / Math.PI));
}

// ---------------------------------------------------------------------------
// normalizeLandmarks
//
// Makes a pose scale- and position-invariant so frames from different
// distances/camera zooms can be compared against reference poses.
//
// Transform applied:
//   1. Translate — subtract the hip midpoint (origin = center of hips)
//   2. Scale — divide by shoulder width (1.0 = one shoulder-width unit)
//
// The result is a new landmarks array with the same 33 points, where:
//   - Hip midpoint is at (0, 0)
//   - Shoulder width is always 1.0
//   - z and visibility are preserved unchanged
// ---------------------------------------------------------------------------

export function normalizeLandmarks(landmarks: PoseLandmarks): PoseLandmarks {
  const L = LandmarkIndex;

  const leftHip      = landmarks[L.LEFT_HIP];
  const rightHip     = landmarks[L.RIGHT_HIP];
  const leftShoulder = landmarks[L.LEFT_SHOULDER];
  const rightShoulder = landmarks[L.RIGHT_SHOULDER];

  // Origin: midpoint between hips
  const originX = (leftHip.x + rightHip.x) / 2;
  const originY = (leftHip.y + rightHip.y) / 2;

  // Scale: Euclidean distance between shoulders
  const shoulderWidth = Math.sqrt(
    (rightShoulder.x - leftShoulder.x) ** 2 +
    (rightShoulder.y - leftShoulder.y) ** 2
  );

  // Avoid division by zero if shoulders overlap (e.g. occluded frame)
  const scale = shoulderWidth > 0 ? shoulderWidth : 1;

  return landmarks.map((lm) => ({
    x: (lm.x - originX) / scale,
    y: (lm.y - originY) / scale,
    z: lm.z,
    visibility: lm.visibility,
  })) as PoseLandmarks;
}
