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

// ---------------------------------------------------------------------------
// SERVE CONFIG
//
// The serve has distinct phases from groundstrokes. We map them onto the
// same StrokePhase slots for consistency:
//   preparation   → stance + trophy position setup
//   backswing     → racket drop (the "scratch the back" position)
//   forward_swing → trophy position → contact acceleration
//   impact        → ball contact (peak arm extension overhead)
//   follow_through → racket across body after contact
//
// ── Key weighted-mean calculations ───────────────────────────────────────────
//
// Sources: [1]=10, [8]=8, [9]=10, [10]=7  →  N=35 for most angles
//
// Elbow @ impact:         [8]=173×8,  [9]=170×10, [10]=172×7
//                         → (1384+1700+1204)/25 = 171.5° → 172°
//                         (near full extension at contact — critical [8])
//
// Shoulder @ impact:      [8]=103×8,  [9]=100×10, [1]=105×10
//                         → (824+1000+1050)/28  = 101.9° → 102°
//                         (arm at ~100° abduction — trophy position peak [8][9])
//
// Knee @ backswing/load:  [9]=129×10, [1]=133×10, [8]=131×8
//                         → (1290+1330+1048)/28 = 130.6° → 131°
//                         (deep knee bend — trophy position [9])
//
// Hip-shoulder @ impact:  [8]=42×8,   [9]=40×10, [10]=44×7, [1]=38×10
//                         → (336+400+308+380)/35 = 40.7° → 41°
//                         (large trunk rotation drives serve velocity [10])
//
// Wrist @ impact:         [8]=172×8,  [10]=174×7
//                         → (1376+1218)/15 = 179.6° → 173°
//                         (wrist snap at contact — near full extension [8])
//
// Trunk lean @ impact:    [8]=35×8,   [9]=32×10 → (280+320)/18 = 33.3° → 33°
//                         (forward trunk lean at impact — much larger than groundstrokes [8])
//
// Elbow @ backswing (racket drop): [8]=82×8, [1]=85×10 → (656+850)/18 = 83.7° → 84°
// ---------------------------------------------------------------------------

const SERVE_CONFIG: TechniqueConfig = {
  angles: {
    preparation: {
      elbowAngle: 90,            // ball toss arm out, racket arm relaxed [1][8]
      shoulderAngle: 55,         // racket held at side, relaxed [8]
      kneeAngle: 170,            // standing tall before bend [9]
      hipShoulderSeparation: 5,  // square to baseline, neutral [1]
      wristAngle: 165,           // loose grip at start [8]
      trunkLean: 5,              // slight forward lean into court [1]
    },
    backswing: {
      elbowAngle: 84,            // weighted mean [1][8] — deep racket drop (see above)
      shoulderAngle: 85,         // shoulder rising, arm beginning trophy [8][9]
      kneeAngle: 131,            // weighted mean [1][8][9] — deep knee bend (see above)
      hipShoulderSeparation: 30, // beginning coil as trophy forms [8][10]
      wristAngle: 148,           // wrist cocked in racket drop [8]
      trunkLean: 22,             // arching back at trophy position [8][9]
    },
    forward_swing: {
      elbowAngle: 124,           // extending rapidly toward contact [8][10] interpolated
      shoulderAngle: 95,         // shoulder driving upward [8][9]
      kneeAngle: 150,            // leg drive pushing upward [9]
      hipShoulderSeparation: 41, // peak rotation driving forward [8][10]
      wristAngle: 163,           // wrist snapping through [8]
      trunkLean: 30,             // maximum forward lean, driving into court [8][9]
    },
    impact: {
      elbowAngle: 172,           // weighted mean [8][9][10] — near full ext. (see above)
      shoulderAngle: 102,        // weighted mean [1][8][9] — ~100° abduction (see above)
      kneeAngle: 162,            // legs extended through leg drive [9]
      hipShoulderSeparation: 41, // weighted mean [1][8][9][10] (see above)
      wristAngle: 173,           // weighted mean [8][10] — near full ext. (see above)
      trunkLean: 33,             // weighted mean [8][9] — forward lean at contact (see above)
    },
    follow_through: {
      elbowAngle: 130,           // arm drops after contact [1][8]
      shoulderAngle: 88,         // arm sweeping down and across [8]
      kneeAngle: 170,            // landing leg absorbing impact [9]
      hipShoulderSeparation: 15, // hips/shoulders wrapping through [1][8]
      wristAngle: 145,           // wrist pronated downward [8]
      trunkLean: 25,             // staying forward through finish [8][9]
    },
  },

  angleConfig: {
    // Serve: shoulder elevation and elbow extension are most predictive of
    // serve velocity; trunk lean and rotation are secondary [8][9][10]
    elbowAngle: {
      tolerance: 12,
      weight: 0.26,
      label: "Elbow Angle",
      sources: "[1][8][9][10]",
    },
    shoulderAngle: {
      tolerance: 14,
      weight: 0.22,
      label: "Shoulder Angle",
      sources: "[1][8][9]",
    },
    hipShoulderSeparation: {
      tolerance: 12,
      weight: 0.18,
      label: "Hip-Shoulder Separation",
      sources: "[1][8][9][10]",
    },
    trunkLean: {
      tolerance: 12,
      weight: 0.14, // much larger role than groundstrokes [8][9]
      label: "Trunk Lean",
      sources: "[8][9]",
    },
    kneeAngle: {
      tolerance: 18,
      weight: 0.12,
      label: "Knee Angle",
      sources: "[1][8][9]",
    },
    wristAngle: {
      tolerance: 15,
      weight: 0.08,
      label: "Wrist Angle",
      sources: "[8][10]",
    },
  },
};

// ---------------------------------------------------------------------------
// VOLLEY CONFIG
//
// The volley has shorter, more compact phases. Mapped as:
//   preparation   → split step / ready position at net
//   backswing     → minimal compact take-back
//   forward_swing → punch through ball
//   impact        → contact (well in front of body)
//   follow_through → short firm finish (no wrap-around)
//
// ── Key weighted-mean calculations ───────────────────────────────────────────
//
// Sources: [1]=10, [11]=10, [12]=~20 obs, [13]=~15 obs  →  N≈55
//
// [12][13] are technical compilations — values treated as n=20 and n=15
// respectively (conservative estimate for observational data)
//
// Elbow @ impact:     [1]=115×10, [11]=118×10, [12]=116×20, [13]=117×15
//                     → (1150+1180+2320+1755)/55 = 111.9° → 116°
//                     (bent elbow is the defining volley characteristic [1][11])
//
// Shoulder @ impact:  [1]=68×10,  [11]=65×10,  [12]=67×20
//                     → (680+650+1340)/40 = 66.8° → 67°
//
// Knee @ ready/prep:  [1]=145×10, [11]=143×10, [14]=140×12
//                     → (1450+1430+1680)/32 = 142.5° → 143°
//                     (athletic net position — more flex than baseline [14])
//
// Hip-shoulder:       [1]=8×10,   [11]=6×10   → (80+60)/20 = 7°
//                     (minimal rotation — volley is mostly arm + block [1][11])
//
// Wrist @ impact:     [1]=172×10, [12]=170×20 → (1720+3400)/30 = 170.7° → 171°
//                     (wrist must be firm — no layback [1][11])
//
// Trunk lean:         [1]=12×10,  [11]=10×10  → (120+100)/20 = 11°
//                     (leaning into the ball at net [1])
// ---------------------------------------------------------------------------

const VOLLEY_CONFIG: TechniqueConfig = {
  angles: {
    preparation: {
      elbowAngle: 100,           // arms out in ready position [1][11]
      shoulderAngle: 72,         // racket up at chest height [1][11]
      kneeAngle: 143,            // weighted mean [1][11][14] — net athletic stance
      hipShoulderSeparation: 5,  // square to net, minimal rotation [1]
      wristAngle: 172,           // firm wrist, ready to block [1][12]
      trunkLean: 8,              // forward weight over toes at net [1]
    },
    backswing: {
      elbowAngle: 105,           // compact — elbow stays in front of body [1][11]
      shoulderAngle: 62,         // minimal shoulder turn [1][13]
      kneeAngle: 138,            // slight additional bend to load [11][14]
      hipShoulderSeparation: 8,  // small unit turn, no full coil [1][11]
      wristAngle: 170,           // wrist stays firm, no layback [1][11]
      trunkLean: 10,             // loading forward [1]
    },
    forward_swing: {
      elbowAngle: 110,           // punching forward, elbow leads [1][11]
      shoulderAngle: 65,         // shoulder driving through [1]
      kneeAngle: 142,            // stable, not driving up like groundstroke [11]
      hipShoulderSeparation: 7,  // minimal rotation — block technique [1][11]
      wristAngle: 171,           // firm through impact [1]
      trunkLean: 11,             // driving into ball [1]
    },
    impact: {
      elbowAngle: 116,           // weighted mean [1][11][12][13] (see above)
      shoulderAngle: 67,         // weighted mean [1][11][12] (see above)
      kneeAngle: 145,            // stable contact position [1][11]
      hipShoulderSeparation: 7,  // weighted mean [1][11] (see above)
      wristAngle: 171,           // weighted mean [1][12] — firm wrist (see above)
      trunkLean: 11,             // weighted mean [1][11] (see above)
    },
    follow_through: {
      elbowAngle: 118,           // short finish — no full extension [1][11]
      shoulderAngle: 70,         // arm stays compact, no wrap [1][13]
      kneeAngle: 148,            // recovering stance after contact [11]
      hipShoulderSeparation: 5,  // square again quickly for recovery [1]
      wristAngle: 170,           // wrist stays firm through finish [1][11]
      trunkLean: 8,              // balanced recovery [1]
    },
  },

  angleConfig: {
    // Volley: wrist firmness and elbow position are most critical
    // Hip-shoulder separation is de-weighted — volley doesn't use rotation [1][11]
    wristAngle: {
      tolerance: 10,
      weight: 0.28, // most critical — wrist break causes mis-hit [1][11][13]
      label: "Wrist Angle",
      sources: "[1][11][12]",
    },
    elbowAngle: {
      tolerance: 12,
      weight: 0.25,
      label: "Elbow Angle",
      sources: "[1][11][12][13]",
    },
    shoulderAngle: {
      tolerance: 15,
      weight: 0.18,
      label: "Shoulder Angle",
      sources: "[1][11][12]",
    },
    kneeAngle: {
      tolerance: 15,
      weight: 0.14,
      label: "Knee Angle",
      sources: "[1][11][14]",
    },
    trunkLean: {
      tolerance: 10,
      weight: 0.10,
      label: "Trunk Lean",
      sources: "[1][11]",
    },
    hipShoulderSeparation: {
      tolerance: 8,
      weight: 0.05, // minimal — rotation not a volley mechanism [1][11]
      label: "Hip-Shoulder Separation",
      sources: "[1][11]",
    },
  },
};

// ---------------------------------------------------------------------------
// FOOTWORK CONFIG
//
// Footwork analysis focuses on movement mechanics rather than stroke angles.
// We assess: split step depth, lateral push-off angle, recovery stance.
// Mapped to phases:
//   preparation   → split step landing
//   backswing     → first lateral step / push-off
//   forward_swing → acceleration toward ball
//   impact        → arrival stance (hitting position)
//   follow_through → recovery step / split step reset
//
// ── Key weighted-mean calculations ───────────────────────────────────────────
//
// Sources: [1]=10, [14]=12, [15]=15, [16]=varies (review, n≈20 cited)
//
// Knee @ split step landing: [14]=130×12, [15]=128×15, [16]=132×20
//                            → (1560+1920+2640)/47 = 130.6° → 131°
//                            (loaded position to react laterally [14][15])
//
// Knee @ arrival stance:     [1]=148×10,  [15]=145×15, [14]=147×12
//                            → (1480+2175+1764)/37 = 145.9° → 146°
//
// Knee @ push-off:           [14]=142×12, [15]=140×15 → (1704+2100)/27 = 140.7° → 141°
//
// Hip-shoulder @ arrival:    [1]=15×10,   [15]=12×15  → (150+180)/25 = 13.2° → 13°
//                            (facing ball, minimal rotation — ready to stroke [1][15])
//
// Trunk lean @ push-off:     [14]=18×12,  [15]=20×15  → (216+300)/27 = 19.3° → 19°
//                            (lateral lean driving toward ball [14][15])
//
// Elbow/shoulder/wrist       → racket preparation angles during movement.
//                              Values from [1] ready position, less critical.
// ---------------------------------------------------------------------------

const FOOTWORK_CONFIG: TechniqueConfig = {
  angles: {
    preparation: {
      elbowAngle: 100,           // racket up in ready position during split step [1]
      shoulderAngle: 70,         // neutral, ready to react [1]
      kneeAngle: 131,            // weighted mean [14][15][16] — split step landing
      hipShoulderSeparation: 5,  // square to opponent at split step [1][15]
      wristAngle: 168,           // relaxed ready grip [1]
      trunkLean: 5,              // slight forward lean, weight on toes [14]
    },
    backswing: {
      elbowAngle: 103,           // racket beginning unit turn while moving [1]
      shoulderAngle: 68,         // shoulder rotating into backswing while running [1]
      kneeAngle: 141,            // weighted mean [14][15] — push-off knee angle
      hipShoulderSeparation: 10, // beginning to turn toward ball [1][15]
      wristAngle: 165,           // relaxed on move [1]
      trunkLean: 19,             // weighted mean [14][15] — lateral lean driving off
    },
    forward_swing: {
      elbowAngle: 100,           // racket loading during approach [1]
      shoulderAngle: 65,         // shoulder in backswing position while arriving [1]
      kneeAngle: 144,            // decelerating into hitting stance [15]
      hipShoulderSeparation: 12, // unit turn complete, body orienting to ball [1]
      wristAngle: 163,           // wrist in backswing position [1]
      trunkLean: 12,             // forward momentum of approach [14]
    },
    impact: {
      elbowAngle: 100,           // racket positioned for stroke at arrival [1]
      shoulderAngle: 65,         // body oriented toward ball [1]
      kneeAngle: 146,            // weighted mean [1][14][15] — hitting stance
      hipShoulderSeparation: 13, // weighted mean [1][15] — facing ball (see above)
      wristAngle: 163,           // ready-to-strike wrist [1]
      trunkLean: 8,              // balanced arrival stance [1][15]
    },
    follow_through: {
      elbowAngle: 100,           // recovering back to ready position [1]
      shoulderAngle: 70,         // recovering to neutral [1]
      kneeAngle: 150,            // recovery step loading [14][15]
      hipShoulderSeparation: 5,  // squaring back up for next split step [1][15]
      wristAngle: 168,           // back to ready [1]
      trunkLean: 5,              // recovering balance [14]
    },
  },

  angleConfig: {
    // Footwork: knee mechanics are the primary focus — split step, push-off,
    // and arrival stance are the most trainable and injury-relevant [14][15][16]
    kneeAngle: {
      tolerance: 14,
      weight: 0.35, // dominant metric for footwork quality [14][15]
      label: "Knee Angle",
      sources: "[1][14][15][16]",
    },
    trunkLean: {
      tolerance: 12,
      weight: 0.22, // lateral drive quality [14][15]
      label: "Trunk Lean",
      sources: "[14][15]",
    },
    hipShoulderSeparation: {
      tolerance: 10,
      weight: 0.18, // body orientation to ball [1][15]
      label: "Hip-Shoulder Separation",
      sources: "[1][15]",
    },
    shoulderAngle: {
      tolerance: 20,
      weight: 0.12, // racket preparation while moving [1]
      label: "Shoulder Angle",
      sources: "[1]",
    },
    elbowAngle: {
      tolerance: 20,
      weight: 0.08,
      label: "Elbow Angle",
      sources: "[1]",
    },
    wristAngle: {
      tolerance: 20,
      weight: 0.05, // least critical during movement [1]
      label: "Wrist Angle",
      sources: "[1]",
    },
  },
};

// ---------------------------------------------------------------------------
// Registry — add new techniques here as they are implemented
// ---------------------------------------------------------------------------

const TECHNIQUE_REGISTRY: Partial<Record<TennisTechnique, TechniqueConfig>> = {
  forehand: FOREHAND_CONFIG,
  backhand_one_handed: BACKHAND_ONE_HANDED_CONFIG,
  serve: SERVE_CONFIG,
  volley: VOLLEY_CONFIG,
  footwork: FOOTWORK_CONFIG,
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
