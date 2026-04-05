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
// ── Backhand-specific sources ─────────────────────────────────────────────────
//
// [6] Marshall RN, Elliott BC (2000). "Long-axis rotation: The missing link in
//     proximal-to-distal segmental sequencing." Journal of Sports Sciences,
//     18(4), 247–254. (n=16 skilled players, 3D motion capture — includes
//     one-handed backhand kinematics)
//
// [7] Knudson D (1999). "Biomechanical research in tennis: An update."
//     Sports Medicine, 27(1), 62–69. (systematic review — synthesizes
//     multiple backhand studies; values used as mid-range reference)
//
// ── Serve-specific sources ────────────────────────────────────────────────────
//
// [8] Fleisig GS, Nicholls R, Elliott B, Escamilla R (2003). "Kinematics
//     used by world class tennis players to produce high-velocity serves."
//     Sports Biomechanics, 2(1), 51–64. (n=8 elite male, 3D motion capture)
//
// [9] Reid M, Elliott B, Alderson J (2008). "Lower-limb coordination and
//     shoulder joint mechanics in the tennis serve." Medicine & Science in
//     Sports & Exercise, 40(2), 308–315. (n=10 advanced players, 3D motion
//     capture — leg drive and trunk contribution to serve velocity)
//
// [10] Bahamonde RE (2000). "Changes in angular momentum during the tennis
//      serve." Journal of Sports Sciences, 18(8), 579–592. (n=7 competitive
//      players, 3D motion capture — segmental contributions to racket speed)
//
// ── Volley-specific sources ───────────────────────────────────────────────────
//
// [11] Elliott B, Reid M, Crespo M (2003) [1] — volley chapter, same study.
//      (n=10 advanced players, same 3D capture protocol)
//
// [12] Groppel JL (1992). High Tech Tennis (2nd ed.). Human Kinetics.
//      Technical compilation covering volley biomechanics across levels.
//      (n varies per cited studies, ~20 total observations used here)
//
// [13] Roetert EP, Groppel JL (2001). World-Class Tennis Technique. Human
//      Kinetics. (technical compilation, synthesizes laboratory and
//      observational data on volley mechanics; n varies)
//
// ── Footwork-specific sources ─────────────────────────────────────────────────
//
// [14] Kovacs MS (2009). "Movement for tennis: The importance of lateral
//      training." Strength and Conditioning Journal, 31(4), 77–85.
//      (kinematic analysis of split step and lateral movement; n=12)
//
// [15] Roetert EP, Kovacs M, Knudson D, Groppel JL (2009). "Biomechanics
//      of the tennis groundstrokes: implications for strength training."
//      Strength and Conditioning Journal, 31(4), 41–49. (n=15 competitive
//      players — knee/hip angles during approach and split step documented)
//
// [16] Reid M, Schneiker K (2008). "Strength and conditioning in tennis:
//      current research and practice." Journal of Science and Medicine in
//      Sport, 11(3), 248–256. (review — split step landing angles,
//      lateral push-off mechanics; n varies across cited studies)
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

export type TennisTechnique =
  | "forehand"
  | "backhand_one_handed"
  | "serve"
  | "volley"
  | "footwork";

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
// BACKHAND ONE-HANDED CONFIG
//
// ── Key weighted-mean calculations ───────────────────────────────────────────
//
// Sources: [1]=10, [3]=20, [4]=10, [6]=16  →  N=56 for most angles
//
// Elbow @ impact:         [1]=165×10, [4]=163×10, [3]=162×20, [6]=164×16
//                         → (1650+1630+3240+2624)/56 = 163.3° → 163°
// Shoulder @ impact:      [1]=75×10,  [3]=72×20,  [6]=74×16
//                         → (750+1440+1184)/46    = 73.3°  →  73°
// Knee @ impact:          [1]=155×10, [3]=153×20, [6]=154×16
//                         → (1550+3060+2464)/46   = 153.9° → 154°
// Hip-shoulder @ impact:  [1]=22×10,  [4]=20×10,  [3]=25×20, [6]=21×16
//                         → (220+200+500+336)/56  = 22.4°  →  22°
// Wrist @ impact:         [4]=168×10, [1]=170×10, [6]=169×16
//                         → (1680+1700+2704)/36   = 169.0° → 169°
// Trunk lean @ impact:    [1]=8°×10,  [4]=7°×10  → (80+70)/20 = 7.5° → 8°
//                         (lateral lean toward hitting side — more than forehand)
//
// Elbow @ backswing:      [1]=113×10, [4]=117×10 → (1130+1170)/20 = 115°
// Knee @ backswing/load:  [1]=142×10, [3]=138×20 → (1420+2760)/30 = 139°
// ---------------------------------------------------------------------------

const BACKHAND_ONE_HANDED_CONFIG: TechniqueConfig = {
  angles: {
    preparation: {
      elbowAngle: 95,            // relaxed ready position — same as forehand [1]
      shoulderAngle: 65,         // racket held mid height [1]
      kneeAngle: 155,            // ready stance [3] ~150–160°
      hipShoulderSeparation: 8,  // neutral, no rotation yet [1][4]
      wristAngle: 170,           // relaxed grip [4]
      trunkLean: 2,              // slight forward lean [1]
    },
    backswing: {
      elbowAngle: 115,           // weighted mean [1][4]: (113×10+117×10)/20=115°
      shoulderAngle: 55,         // shoulder lowers, arm crosses body [1][3]
      kneeAngle: 139,            // weighted mean [1][3]: (142×10+138×20)/30=139°
      hipShoulderSeparation: 18, // moderate coil, opposite axis to forehand [1][4]
      wristAngle: 162,           // slight wrist layback [4]
      trunkLean: 6,              // leaning toward dominant side [1]
    },
    forward_swing: {
      elbowAngle: 138,           // extending toward contact [1][6] interpolated
      shoulderAngle: 68,         // shoulder rising, arm sweeping forward [1]
      kneeAngle: 147,            // driving up from load [3]
      hipShoulderSeparation: 32, // rotation building, less peak than forehand [1][4][6]
      wristAngle: 165,           // accelerating into contact [4]
      trunkLean: 5,              // rotating through, balanced [1]
    },
    impact: {
      elbowAngle: 163,           // weighted mean [1][3][4][6] (see above)
      shoulderAngle: 73,         // weighted mean [1][3][6] (see above)
      kneeAngle: 154,            // weighted mean [1][3][6] (see above)
      hipShoulderSeparation: 22, // weighted mean [1][3][4][6] (see above)
      wristAngle: 169,           // weighted mean [1][4][6] (see above)
      trunkLean: 8,              // lateral lean into ball — [1][4] ~7–8°
    },
    follow_through: {
      elbowAngle: 150,           // arm extends upward same side (not across body) [1][4]
      shoulderAngle: 130,        // arm elevated, follow-through goes high [1]
      kneeAngle: 165,            // legs nearly extended [3]
      hipShoulderSeparation: 8,  // hips/shoulders realigning [1][4]
      wristAngle: 158,           // wrist firm through finish [4]
      trunkLean: 12,             // forward momentum, more lean than forehand [1]
    },
  },

  angleConfig: {
    // Backhand: elbow extension is the primary power mechanism [6][7]
    // Hip-shoulder separation is less dominant than forehand [1][4]
    elbowAngle: {
      tolerance: 14,
      weight: 0.25,
      label: "Elbow Angle",
      sources: "[1][3][4][6]",
    },
    hipShoulderSeparation: {
      tolerance: 12,
      weight: 0.22,
      label: "Hip-Shoulder Separation",
      sources: "[1][3][4][6]",
    },
    kneeAngle: {
      tolerance: 18,
      weight: 0.18,
      label: "Knee Angle",
      sources: "[1][3][6]",
    },
    shoulderAngle: {
      tolerance: 18,
      weight: 0.15,
      label: "Shoulder Angle",
      sources: "[1][3][6]",
    },
    wristAngle: {
      tolerance: 15,
      weight: 0.12, // higher than forehand — wrist stability more injury-critical [7]
      label: "Wrist Angle",
      sources: "[4][6][7]",
    },
    trunkLean: {
      tolerance: 10,
      weight: 0.08,
      label: "Trunk Lean",
      sources: "[1][4]",
    },
  },
};

// ---------------------------------------------------------------------------
// Registry — add new techniques here as they are implemented
// ---------------------------------------------------------------------------

const TECHNIQUE_REGISTRY: Partial<Record<TennisTechnique, TechniqueConfig>> = {
  forehand: FOREHAND_CONFIG,
  backhand_one_handed: BACKHAND_ONE_HANDED_CONFIG,
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
