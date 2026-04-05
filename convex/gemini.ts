"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ConvexError("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Pose analysis helpers ────────────────────────────────────────────────────

// Evidence-based reference ranges per technique (mean ± tolerance).
// Source: same scientific literature cited in reference-angles.ts.
const REFERENCE_RANGES: Record<string, Record<string, { ideal: number; tol: number; label: string }>> = {
  forehand: {
    elbowAtImpact:         { ideal: 110, tol: 15, label: "elbow angle at impact" },
    kneeAtLoad:            { ideal: 135, tol: 15, label: "knee angle at backswing/load" },
    hipShoulderSeparation: { ideal: 45,  tol: 15, label: "hip–shoulder separation" },
  },
  backhand_one_handed: {
    elbowAtImpact:         { ideal: 165, tol: 10, label: "elbow angle at impact" },
    kneeAtLoad:            { ideal: 135, tol: 15, label: "knee angle at backswing/load" },
    hipShoulderSeparation: { ideal: 35,  tol: 10, label: "hip–shoulder separation" },
  },
  serve: {
    elbowAtImpact:         { ideal: 175, tol: 10, label: "elbow angle at impact" },
    kneeAtLoad:            { ideal: 120, tol: 15, label: "knee angle at trophy position" },
    hipShoulderSeparation: { ideal: 50,  tol: 15, label: "hip–shoulder separation" },
  },
  volley: {
    elbowAtImpact:         { ideal: 120, tol: 15, label: "elbow angle at contact" },
    kneeAtLoad:            { ideal: 150, tol: 15, label: "knee angle at ready position" },
    hipShoulderSeparation: { ideal: 20,  tol: 10, label: "hip–shoulder separation" },
  },
  footwork: {
    kneeAtLoad:            { ideal: 140, tol: 15, label: "knee angle at split step" },
    hipShoulderSeparation: { ideal: 15,  tol: 10, label: "hip–shoulder separation at ready" },
  },
};

function deviation(measured: number, ideal: number, tol: number): string {
  const diff = measured - ideal;
  if (Math.abs(diff) <= tol) return "within ideal range";
  return diff > 0
    ? `${Math.round(diff)}° above ideal (too extended/open)`
    : `${Math.round(Math.abs(diff))}° below ideal (too bent/closed)`;
}

type PoseAnalysisJson = {
  technique: string;
  dominantHand: string;
  fps: number;
  totalFrames: number;
  keyFrames: Array<{
    phase: string;
    elbowAngle: number;
    kneeAngle: number;
    hipShoulderSeparation: number;
    wristAheadOfHip: boolean;
    followThroughComplete: boolean;
    weightOnFrontFoot: boolean;
    visibilityConfidence: number;
  }>;
  summary: {
    avgElbowAngleAtImpact: number;
    avgKneeAngleAtLoad: number;
    avgHipShoulderSeparation: number;
    followThroughCompletionRate: number;
    weightTransferDetected: boolean;
    lowConfidenceFrames: number;
  };
};

function buildPoseAnalysisSummary(poseAnalysisJson: string): string {
  let a: PoseAnalysisJson;
  try {
    a = JSON.parse(poseAnalysisJson) as PoseAnalysisJson;
  } catch {
    return "";
  }

  const ref = REFERENCE_RANGES[a.technique] ?? REFERENCE_RANGES.forehand;
  const s = a.summary;

  const lines: string[] = [
    `Technique scored: ${a.technique} (${a.dominantHand}-handed) — ${a.totalFrames} frames at ${a.fps} fps`,
    `Low-confidence frames skipped: ${s.lowConfidenceFrames}`,
    "",
    "Aggregate biomechanics vs. ideal ranges:",
  ];

  if (ref.elbowAtImpact) {
    lines.push(
      `  Elbow angle at impact: ${s.avgElbowAngleAtImpact}° ` +
      `(ideal ${ref.elbowAtImpact.ideal}° ±${ref.elbowAtImpact.tol}°) — ` +
      deviation(s.avgElbowAngleAtImpact, ref.elbowAtImpact.ideal, ref.elbowAtImpact.tol)
    );
  }
  if (ref.kneeAtLoad) {
    lines.push(
      `  Knee angle at load: ${s.avgKneeAngleAtLoad}° ` +
      `(ideal ${ref.kneeAtLoad.ideal}° ±${ref.kneeAtLoad.tol}°) — ` +
      deviation(s.avgKneeAngleAtLoad, ref.kneeAtLoad.ideal, ref.kneeAtLoad.tol)
    );
  }
  if (ref.hipShoulderSeparation) {
    lines.push(
      `  Hip–shoulder separation: ${s.avgHipShoulderSeparation}° ` +
      `(ideal ${ref.hipShoulderSeparation.ideal}° ±${ref.hipShoulderSeparation.tol}°) — ` +
      deviation(s.avgHipShoulderSeparation, ref.hipShoulderSeparation.ideal, ref.hipShoulderSeparation.tol)
    );
  }

  lines.push(
    `  Follow-through completion: ${Math.round(s.followThroughCompletionRate * 100)}%`,
    `  Weight transfer: ${s.weightTransferDetected ? "detected ✓" : "not detected ✗"}`
  );

  if (a.keyFrames.length > 0) {
    lines.push("", "Per-phase key frame breakdown:");
    for (const kf of a.keyFrames) {
      const flags: string[] = [];
      if (kf.weightOnFrontFoot) flags.push("weight forward");
      if (kf.followThroughComplete) flags.push("follow-through complete");
      if (kf.wristAheadOfHip) flags.push("wrist ahead of hip");
      lines.push(
        `  [${kf.phase}] elbow ${kf.elbowAngle}°, knee ${kf.kneeAngle}°, ` +
        `hip-shoulder sep ${kf.hipShoulderSeparation}°` +
        (flags.length > 0 ? ` | ${flags.join(", ")}` : "")
      );
    }
  }

  return `Biomechanical pose analysis (MediaPipe):\n${lines.join("\n")}`;
}

function buildSessionContext(
  sport: string,
  requestedSections: string[],
  twelveLabsResult?: string,
  poseAnalysis?: string
): string {
  const parts = [
    `Sport: ${sport}`,
    `Sections analyzed: ${requestedSections.join(", ")}`,
    twelveLabsResult
      ? `Video intelligence (TwelveLabs):\n${twelveLabsResult}`
      : "Video intelligence: not yet available.",
  ];
  if (poseAnalysis) {
    parts.push(buildPoseAnalysisSummary(poseAnalysis));
  }
  return parts.join("\n\n");
}

const COACH_SYSTEM_PROMPT = `You are an expert sports coach providing personalized, constructive feedback.
You have two data sources for every session:
1. TwelveLabs video intelligence — general observations about what the player did, including timestamps of key moments.
2. MediaPipe biomechanical analysis — precise joint angles measured frame-by-frame, compared against evidence-based ideal ranges.

When giving feedback, always cross-reference both sources. Use plain, direct language a club-level player would understand — say things like "your elbow is flaring out" or "you're not bending your knees enough at the load", then back it up with the measured angle and how far it is from the ideal. Where TwelveLabs provides a timestamp for an observation, include it so the player can scrub to that moment in the video. If both sources flag the same issue, treat it as a confirmed problem. If only one source flags it, still mention it.

Keep responses concise and actionable. Use bullet points for critique items. Each critique should follow this pattern:
  • [Plain-language issue] — [timestamp if available] — measured [X°] vs ideal [Y°], [deviation].`;

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * One-shot structured feedback generated after video analysis completes.
 */
export const generateFeedback = action({
  args: {
    sessionId: v.id("sessions"),
    analysisId: v.id("analyses"),
  },
  handler: async (ctx, args): Promise<string> => {
    const [session, analysis] = await Promise.all([
      ctx.runQuery(api.sessions.getSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.analyses.getAnalysis, { analysisId: args.analysisId }),
    ]);

    const sessionContext = buildSessionContext(
      session.sport,
      session.requestedSections,
      analysis.twelveLabsResult ?? undefined,
      analysis.poseAnalysis ?? undefined
    );

    const prompt = `You are an expert sports coach. Using the session data below, produce structured coaching feedback.

${sessionContext}

Rules:
- Cross-reference TwelveLabs observations (with their timestamps) against MediaPipe angle measurements.
- In "improvements", each item must name the specific joint/movement issue in plain language (e.g. "elbow flaring at impact"), cite the measured angle vs the ideal range, and include any relevant TwelveLabs timestamp so the player can find it in the video.
- In "strengths", highlight what the data confirms is good.
- In "drills", recommend one drill per improvement area.

Respond with a JSON object in this exact shape:
{
  "summary": "2-3 sentence overall assessment referencing both data sources",
  "strengths": ["confirmed strength with supporting data"],
  "improvements": ["plain-language issue — [timestamp if available] — measured Xdeg vs ideal Ydeg (deviation)"],
  "drills": ["drill targeting the corresponding improvement"]
}`;

    let raw: string;
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      raw = result.response.text();
    } catch (err) {
      throw new ConvexError(`Gemini API error: ${String(err)}`);
    }

    let parsed: {
      summary: string;
      strengths: string[];
      improvements: string[];
      drills: string[];
    };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new ConvexError("Failed to parse Gemini feedback response");
    }

    return await ctx.runMutation(api.feedback.saveFeedback, {
      sessionId: args.sessionId,
      analysisId: args.analysisId,
      summary: parsed.summary,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      drills: parsed.drills,
      rawResponse: raw,
    });
  },
});

/**
 * Conversational "Ask Your Coach" action.
 * Reads chat history for the session and sends it to Gemini for multi-turn context.
 */
export const askCoach = action({
  args: {
    sessionId: v.id("sessions"),
    userMessage: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!args.userMessage.trim()) {
      throw new ConvexError("message cannot be empty");
    }

    const [session, history, feedbackList, analyses] = await Promise.all([
      ctx.runQuery(api.sessions.getSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.messages.getMessages, { sessionId: args.sessionId }),
      ctx.runQuery(api.feedback.getFeedbackForSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.analyses.getAnalysisForSession, { sessionId: args.sessionId }),
    ]);

    // Persist the user's message
    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.userMessage.trim(),
    });

    // Build system context from session + latest analysis + latest feedback
    const latestAnalysis = analyses[0];
    const latestFeedback = feedbackList[feedbackList.length - 1];
    const sessionContext = buildSessionContext(
      session.sport,
      session.requestedSections,
      latestAnalysis?.twelveLabsResult ?? undefined,
      latestAnalysis?.poseAnalysis ?? undefined
    );
    const feedbackContext = latestFeedback
      ? `Previous coaching feedback summary: ${latestFeedback.summary}`
      : "No prior feedback available yet.";

    let reply: string;
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `${COACH_SYSTEM_PROMPT}\n\nSession context:\n${sessionContext}\n\n${feedbackContext}`,
      });

      // Build multi-turn history for Gemini
      const chat = model.startChat({
        history: history.map((msg: { role: "user" | "model"; content: string }) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
      });

      const result = await chat.sendMessage(args.userMessage.trim());
      reply = result.response.text();
    } catch (err) {
      throw new ConvexError(`Gemini API error: ${String(err)}`);
    }

    // Persist Gemini's reply
    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "model",
      content: reply,
    });

    return reply;
  },
});
