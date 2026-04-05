// =============================================================================
// reference-angles.ts
//
// Evidence-based biomechanical reference data for tennis stroke analysis.
// This is the single source of truth for all MediaPipe scoring functions.
//
// ── Literature sources ────────────────────────────────────────────────────────
//
// [1] Elliott B, Reid M, Crespo M (2003). Biomechanics of Advanced Tennis.
//     ITF Ltd. (n=10 advanced players, 3D motion capture)
//
// [2] Knudson D, Bahamonde R (2001). "Wrist and elbow position at ball contact
//     in tennis groundstrokes." Journal of Science and Medicine in Sport,
//     4(1), 74–83. (n=20, mixed levels, high-speed video + electrogoniometry)
//
// [3] Landlinger J, Stöggl T, Lindinger S, Wagner H, Müller E (2010).
//     "Differences in ball speed and accuracy of tennis groundstrokes between
//     elite and high-performance players." European Journal of Sport Science,
//     10(2), 103–110. (n=20: 10 elite, 10 high-performance, 3D motion capture)
//
// [4] Reid M, Elliott B (2002). "The one- and two-handed backhands in tennis."
//     Sports Biomechanics, 1(1), 47–68.
//     Hip-shoulder separation values also apply to forehand open stance.
//     (n=10, 3D motion capture)
//
// [5] Rogowski I, Creveaux T, Faucon A, Rota S, Champely S, Guillot A,
//     Hautier C (2009). "Relationship between muscle coordination and
//     forehand drive velocity in tennis." European Journal of Applied
//     Physiology, 107(3), 289–298. (n=9 competitive players, EMG + kinematics)
//
// ── Synthesis method ──────────────────────────────────────────────────────────
//
// Sample-size weighted mean:  ref = Σ(nᵢ × vᵢ) / Σnᵢ
//
// Inverse-variance weighting is the gold standard for meta-analysis but
// requires per-study SDs, which are not consistently reported across these
// studies. Sample-size weighting is the next best practical approach —
// larger studies exert proportionally more pull, which appropriately
// down-weights the smaller n=9 study [5].
//
// Where a study reports only a range, the midpoint is used.
// Study sample sizes: [1]=10, [2]=20, [3]=20, [4]=10, [5]=9  →  N=69 total
//
// ── Key weighted-mean calculations ───────────────────────────────────────────
//
// Elbow @ impact:         [1]=160×10, [2]=158×20, [5]=162×9  → 159.4° → 160°
// Elbow @ backswing:      [1]=105×10, [2]=108×20             → 107.0° → 107°
// Knee @ backswing/load:  [1]=143×10, [3]=138×20             → 139.7° → 140°
// Hip-shoulder @ impact:  [1]=35×10,  [3]=40×20, [4]=30×10  →  36.3° →  36°
// Hip-shoulder @ fwd:     [1]=45×10,  [3]=48×20, [4]=40×10  →  45.3° →  45°
// Wrist @ impact:         [2]=172×20, [5]=168×9              → 170.8° → 171°
// Shoulder @ impact:      [1]=90×10,  [3]=88×20              →  88.7° →  89°
// Trunk lean:             [1] reports 2–5° lateral → midpoint 3°
//
// =============================================================================

import type { ForehandAngles } from "./pose-utils";

// ---------------------------------------------------------------------------
// Stroke technique identifier — extend as new techniques are added
// ---------------------------------------------------------------------------

export type TennisTechnique = "forehand" | "backhand_one_handed" | "serve";

// ---------------------------------------------------------------------------
// StrokePhase — the 5 temporal phases of a groundstroke + unknown fallback
// ---------------------------------------------------------------------------

export type StrokePhase =
  | "preparation"
  | "backswing"
  | "forward_swing"
  | "impact"
  | "follow_through"
  | "unknown";

// ---------------------------------------------------------------------------
// AngleConfig — per-angle metadata used for both scoring and display
// ---------------------------------------------------------------------------

export interface AngleConfig {
  /**
   * Gaussian tolerance σ (degrees).
   * Controls how fast the score degrades as deviation grows.
   * Larger = more forgiving. Based on between-player SD from [1][3].
   */
  tolerance: number;

  /**
   * Weight in the overall score (all weights sum to 1.0).
   * Based on correlation with ball speed and kinetic-chain contribution [1][2][3].
   */
  weight: number;

  /** Human-readable label for display in the UI */
  label: string;

  /** Sources that inform this angle's reference values */
  sources: string;
}

// ---------------------------------------------------------------------------
// Reference angles per phase (degrees) — sample-size weighted means
// ---------------------------------------------------------------------------

export type PhaseAngles = Record<StrokePhase, ForehandAngles>;

// ---------------------------------------------------------------------------
// Full technique config — angles + metadata bundled together
// ---------------------------------------------------------------------------

export interface TechniqueConfig {
  angles: Omit<PhaseAngles, "unknown">;
  angleConfig: Record<keyof ForehandAngles, AngleConfig>;
}

// ---------------------------------------------------------------------------
// FOREHAND CONFIG
// ---------------------------------------------------------------------------

const FOREHAND_CONFIG: TechniqueConfig = {
  angles: {
    preparation: {
      elbowAngle: 95,            // relaxed ready position [1] ~90–100°
      shoulderAngle: 65,         // racket at mid height [1]
      kneeAngle: 155,            // ready stance slight flex [3] ~150–160°
      hipShoulderSeparation: 8,  // neutral, no coil [1][4]
      wristAngle: 170,           // relaxed grip [2]
      trunkLean: 2,              // slight forward lean [1]
    },
    backswing: {
      elbowAngle: 107,           // weighted mean [1][2]: (105×10+108×20)/30=107°
      shoulderAngle: 60,         // shoulder drops to load racket [1][3]
      kneeAngle: 140,            // weighted mean [1][3]: (143×10+138×20)/30=140°
      hipShoulderSeparation: 20, // beginning coil [1][4]
      wristAngle: 165,           // slight wrist layback [2]
      trunkLean: 5,              // leaning into backswing [1]
    },
    forward_swing: {
      elbowAngle: 128,           // interpolated between backswing→impact [1][5]
      shoulderAngle: 78,         // shoulder rising toward contact [1]
      kneeAngle: 147,            // driving up from loaded position [3]
      hipShoulderSeparation: 45, // weighted mean [1][3][4]: (45×10+48×20+40×10)/40=45°
      wristAngle: 162,           // accelerating into contact [2]
      trunkLean: 3,              // torso rotating, balanced [1]
    },
    impact: {
      elbowAngle: 160,           // weighted mean [1][2][5]: (160×10+158×20+162×9)/39=160°
      shoulderAngle: 89,         // weighted mean [1][3]: (90×10+88×20)/30=89°
      kneeAngle: 155,            // extending through ball [1][3]
      hipShoulderSeparation: 36, // weighted mean [1][3][4]: (35×10+40×20+30×10)/40=36°
      wristAngle: 171,           // weighted mean [2][5]: (172×20+168×9)/29=171°
      trunkLean: 2,              // near-upright at contact [1]
    },
    follow_through: {
      elbowAngle: 138,           // arm wrapping over opposite shoulder [1][5]
      shoulderAngle: 115,        // arm crosses body [1]
      kneeAngle: 162,            // legs nearly extended [3]
      hipShoulderSeparation: 12, // hips and shoulders realigned [1][4]
      wristAngle: 148,           // wrist pronated across body [2]
      trunkLean: 8,              // forward momentum lean [1]
    },
  },

  angleConfig: {
    hipShoulderSeparation: {
      tolerance: 12,
      weight: 0.28,
      label: "Hip-Shoulder Separation",
      sources: "[1][3][4]",
    },
    elbowAngle: {
      tolerance: 15,
      weight: 0.22,
      label: "Elbow Angle",
      sources: "[1][2][5]",
    },
    kneeAngle: {
      tolerance: 18,
      weight: 0.18,
      label: "Knee Angle",
      sources: "[1][3]",
    },
    shoulderAngle: {
      tolerance: 20,
      weight: 0.14,
      label: "Shoulder Angle",
      sources: "[1][3]",
    },
    wristAngle: {
      tolerance: 18,
      weight: 0.10,
      label: "Wrist Angle",
      sources: "[2][5]",
    },
    trunkLean: {
      tolerance: 10,
      weight: 0.08,
      label: "Trunk Lean",
      sources: "[1]",
    },
  },
};

// ---------------------------------------------------------------------------
// Registry — add new techniques here as they are implemented
// ---------------------------------------------------------------------------

const TECHNIQUE_REGISTRY: Partial<Record<TennisTechnique, TechniqueConfig>> = {
  forehand: FOREHAND_CONFIG,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the full technique config (angles + metadata) for a given stroke.
 * Returns the forehand config as a safe fallback for unimplemented techniques.
 */
export function getTechniqueConfig(technique: TennisTechnique): TechniqueConfig {
  return TECHNIQUE_REGISTRY[technique] ?? FOREHAND_CONFIG;
}

/**
 * Returns the reference angles for a specific technique and stroke phase.
 * Falls back to impact angles for unknown phases.
 */
export function getReferenceAngles(
  technique: TennisTechnique,
  phase: StrokePhase
): ForehandAngles {
  const config = getTechniqueConfig(technique);
  return config.angles[phase as keyof typeof config.angles] ?? config.angles.impact;
}

/**
 * Returns the angle config (tolerance, weight, label) for a technique.
 */
export function getAngleConfig(
  technique: TennisTechnique
): Record<keyof ForehandAngles, AngleConfig> {
  return getTechniqueConfig(technique).angleConfig;
}
