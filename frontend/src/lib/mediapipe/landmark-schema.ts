import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive landmark — one point returned by MediaPipe PoseLandmarker
// ---------------------------------------------------------------------------

export const LandmarkSchema = z.object({
  /** Normalized x coordinate in [0, 1] relative to image width */
  x: z.number().min(0).max(1),
  /** Normalized y coordinate in [0, 1] relative to image height */
  y: z.number().min(0).max(1),
  /** Depth relative to hip midpoint. More negative = closer to camera */
  z: z.number(),
  /** Model confidence that the landmark is visible (0–1) */
  visibility: z.number().min(0).max(1),
});

export type Landmark = z.infer<typeof LandmarkSchema>;

// ---------------------------------------------------------------------------
// Full pose — exactly 33 landmarks as defined by MediaPipe BlazePose
// ---------------------------------------------------------------------------

export const PoseLandmarksSchema = z.array(LandmarkSchema).length(33);

export type PoseLandmarks = z.infer<typeof PoseLandmarksSchema>;

// ---------------------------------------------------------------------------
// World landmarks — same 33 points but in metric (meter) space
// z is meaningful depth, not normalized
// ---------------------------------------------------------------------------

export const WorldLandmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: z.number().min(0).max(1),
});

export const WorldLandmarksSchema = z.array(WorldLandmarkSchema).length(33);

export type WorldLandmarks = z.infer<typeof WorldLandmarksSchema>;

// ---------------------------------------------------------------------------
// Named landmark indices — BlazePose 33-point topology
// Use these constants everywhere instead of magic numbers
// ---------------------------------------------------------------------------

export const LandmarkIndex = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type LandmarkName = keyof typeof LandmarkIndex;

// ---------------------------------------------------------------------------
// Tennis-relevant landmark subset — only joints needed for stroke analysis
// ---------------------------------------------------------------------------

export const TENNIS_LANDMARKS = {
  LEFT_SHOULDER: LandmarkIndex.LEFT_SHOULDER,
  RIGHT_SHOULDER: LandmarkIndex.RIGHT_SHOULDER,
  LEFT_ELBOW: LandmarkIndex.LEFT_ELBOW,
  RIGHT_ELBOW: LandmarkIndex.RIGHT_ELBOW,
  LEFT_WRIST: LandmarkIndex.LEFT_WRIST,
  RIGHT_WRIST: LandmarkIndex.RIGHT_WRIST,
  LEFT_HIP: LandmarkIndex.LEFT_HIP,
  RIGHT_HIP: LandmarkIndex.RIGHT_HIP,
  LEFT_KNEE: LandmarkIndex.LEFT_KNEE,
  RIGHT_KNEE: LandmarkIndex.RIGHT_KNEE,
  LEFT_ANKLE: LandmarkIndex.LEFT_ANKLE,
  RIGHT_ANKLE: LandmarkIndex.RIGHT_ANKLE,
} as const;

// ---------------------------------------------------------------------------
// Stroke phase — detected per frame during forehand analysis
// ---------------------------------------------------------------------------

export const StrokePhaseSchema = z.enum([
  "preparation",
  "backswing",
  "forward_swing",
  "impact",
  "follow_through",
  "unknown",
]);

export type StrokePhase = z.infer<typeof StrokePhaseSchema>;

// ---------------------------------------------------------------------------
// Detection result — wraps one or more detected people in a frame
// MediaPipe can return multiple poses; we take the first (index 0)
// ---------------------------------------------------------------------------

export const PoseDetectionResultSchema = z.object({
  /** Normalized image-space landmarks */
  landmarks: z.array(PoseLandmarksSchema),
  /** Metric world-space landmarks (same topology) */
  worldLandmarks: z.array(WorldLandmarksSchema),
  /** Source timestamp in milliseconds */
  timestampMs: z.number().nonnegative(),
});

export type PoseDetectionResult = z.infer<typeof PoseDetectionResultSchema>;

// ---------------------------------------------------------------------------
// Validated frame — a single person's landmarks extracted from a result
// This is the shape passed into poseUtils and up to Convex
// ---------------------------------------------------------------------------

export const ValidatedPoseFrameSchema = z.object({
  landmarks: PoseLandmarksSchema,
  worldLandmarks: WorldLandmarksSchema,
  timestampMs: z.number().nonnegative(),
});

export type ValidatedPoseFrame = z.infer<typeof ValidatedPoseFrameSchema>;

// ---------------------------------------------------------------------------
// Computed frame metrics — derived from raw landmarks, sent to Gemini
// One of these per key frame (not every frame — only phase transitions)
// ---------------------------------------------------------------------------

export const FrameMetricsSchema = z.object({
  timestampMs: z.number().nonnegative(),
  phase: StrokePhaseSchema,

  // Joint angles in degrees, computed from 3 landmarks each
  elbowAngle: z.number(),             // shoulder → elbow → wrist
  kneeAngle: z.number(),              // hip → knee → ankle
  hipShoulderSeparation: z.number(),  // angle between hip line and shoulder line

  // Positional booleans — cleaner signal for Gemini than raw coords
  wristAheadOfHip: z.boolean(),           // wrist x > hip x on dominant side
  followThroughComplete: z.boolean(),     // wrist crosses to opposite shoulder height
  weightOnFrontFoot: z.boolean(),         // front ankle y lower than back ankle y

  // Ratios
  contactHeightRatio: z.number().min(0).max(1), // wrist y / body height at impact
  hipRotationVelocity: z.number(),              // degrees per second

  // Skip scoring this frame if below threshold (e.g. 0.6)
  visibilityConfidence: z.number().min(0).max(1),
});

export type FrameMetrics = z.infer<typeof FrameMetricsSchema>;

// ---------------------------------------------------------------------------
// Full analysis result — one per video clip, sent to Convex then Gemini
// ---------------------------------------------------------------------------

export const AnalysisResultSchema = z.object({
  sport: z.literal("tennis"),
  technique: z.enum(["forehand", "backhand_one_handed", "serve"]),
  dominantHand: z.enum(["left", "right"]),
  fps: z.number().positive(),
  totalFrames: z.number().int().nonnegative(),

  // Key frames only — one per phase transition, not every raw frame
  keyFrames: z.array(FrameMetricsSchema),

  summary: z.object({
    avgElbowAngleAtImpact: z.number(),
    avgKneeAngleAtLoad: z.number(),
    avgHipShoulderSeparation: z.number(),
    followThroughCompletionRate: z.number().min(0).max(1),
    weightTransferDetected: z.boolean(),
    lowConfidenceFrames: z.number().int().nonnegative(),
  }),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts and validates the first detected person from a raw MediaPipe result.
 * Returns null if no person was detected or validation fails.
 */
export function parseFirstPose(raw: unknown): ValidatedPoseFrame | null {
  const result = PoseDetectionResultSchema.safeParse(raw);
  if (!result.success || result.data.landmarks.length === 0) return null;

  return ValidatedPoseFrameSchema.parse({
    landmarks: result.data.landmarks[0],
    worldLandmarks: result.data.worldLandmarks[0],
    timestampMs: result.data.timestampMs,
  });
}
