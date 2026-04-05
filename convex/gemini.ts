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

// BlazePose joint indices for tennis-relevant landmarks
const TENNIS_JOINTS: Record<string, number> = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
};

type Lm = { x: number; y: number; z: number; visibility: number };

function calcAngle2D(a: Lm, b: Lm, c: Lm): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const mag = Math.sqrt(ba.x ** 2 + ba.y ** 2) * Math.sqrt(bc.x ** 2 + bc.y ** 2);
  return mag === 0 ? 0 : (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function buildPoseSummary(frames: Lm[][]): string {
  if (frames.length === 0) return "";

  // Average visibility per key joint
  const avgVis: Record<string, number> = {};
  for (const [name, idx] of Object.entries(TENNIS_JOINTS)) {
    const vals = frames.map((f) => f[idx]?.visibility ?? 0);
    avgVis[name] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const tracked = Object.entries(avgVis)
    .filter(([, v]) => v >= 0.6)
    .map(([name]) => name);

  // Representative frame angles (first, mid, last)
  const indices = [0, Math.floor(frames.length / 2), frames.length - 1];
  const angleLines: string[] = [];
  for (const fi of indices) {
    const f = frames[fi];
    const ts = ((fi / frames.length) * 100).toFixed(0);
    for (const [side, shoulder, elbow, wrist] of [
      ["Right", 12, 14, 16],
      ["Left", 11, 13, 15],
    ] as [string, number, number, number][]) {
      if (
        f[shoulder].visibility >= 0.6 &&
        f[elbow].visibility >= 0.6 &&
        f[wrist].visibility >= 0.6
      ) {
        const angle = calcAngle2D(f[shoulder], f[elbow], f[wrist]);
        angleLines.push(`  ${side} elbow angle at ~${ts}% of video: ${Math.round(angle)}°`);
      }
    }
  }

  const lines = [
    `Pose analysis: ${frames.length} frames sampled at 5 fps`,
    `Joints tracked with ≥60% confidence: ${tracked.join(", ") || "none"}`,
    ...(angleLines.length > 0 ? ["Elbow angles (shoulder→elbow→wrist):", ...angleLines] : []),
  ];
  return `Biomechanical pose data:\n${lines.map((l) => `  ${l}`).join("\n")}`;
}

function buildSessionContext(
  sport: string,
  requestedSections: string[],
  twelveLabsResult?: string,
  poseLandmarks?: Lm[][]
): string {
  const parts = [
    `Sport: ${sport}`,
    `Sections analyzed: ${requestedSections.join(", ")}`,
    twelveLabsResult
      ? `Video analysis results:\n${twelveLabsResult}`
      : "Video analysis not yet available.",
  ];
  if (poseLandmarks && poseLandmarks.length > 0) {
    parts.push(buildPoseSummary(poseLandmarks));
  }
  return parts.join("\n");
}

const COACH_SYSTEM_PROMPT = `You are an expert sports coach providing personalized, constructive feedback.
You have access to video analysis data and biomechanical information about the player's technique.
When the player asks about specific aspects (forehand, backhand, serve, volley, footwork),
focus your response on those areas using the analysis data available.
You can also compare across multiple sessions when asked.
Keep responses concise, specific, and actionable. Use bullet points where helpful.`;

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
      analysis.poseLandmarks ?? undefined
    );

    const prompt = `Based on the following session data, provide structured coaching feedback.

${sessionContext}

Respond with a JSON object in this exact shape:
{
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area to improve 1", "area to improve 2"],
  "drills": ["drill recommendation 1", "drill recommendation 2"]
}`;

    let raw: string;
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

    const [session, history, feedbackList] = await Promise.all([
      ctx.runQuery(api.sessions.getSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.messages.getMessages, { sessionId: args.sessionId }),
      ctx.runQuery(api.feedback.getFeedbackForSession, {
        sessionId: args.sessionId,
      }),
    ]);

    // Persist the user's message
    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.userMessage.trim(),
    });

    // Build system context from session + latest feedback
    const latestFeedback = feedbackList[feedbackList.length - 1];
    const sessionContext = buildSessionContext(
      session.sport,
      session.requestedSections
    );
    const feedbackContext = latestFeedback
      ? `Previous coaching feedback summary: ${latestFeedback.summary}`
      : "No prior feedback available yet.";

    let reply: string;
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
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
