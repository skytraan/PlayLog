"use node";

import { ConvexError, v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Internal mutations for persisting messages ───────────────────────────────

export const saveMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("model")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const saveFeedback = mutation({
  args: {
    sessionId: v.id("sessions"),
    analysisId: v.id("analyses"),
    summary: v.string(),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    drills: v.array(v.string()),
    rawResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new ConvexError(`Session ${args.sessionId} not found`);

    return await ctx.db.insert("feedback", {
      sessionId: args.sessionId,
      analysisId: args.analysisId,
      summary: args.summary,
      strengths: args.strengths,
      improvements: args.improvements,
      drills: args.drills,
      rawResponse: args.rawResponse,
      createdAt: Date.now(),
    });
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ConvexError("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

function buildSessionContext(
  sport: string,
  requestedSections: string[],
  twelveLabsResult?: string
): string {
  return [
    `Sport: ${sport}`,
    `Sections analyzed: ${requestedSections.join(", ")}`,
    twelveLabsResult
      ? `Video analysis results:\n${twelveLabsResult}`
      : "Video analysis not yet available.",
  ].join("\n");
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
  handler: async (ctx, args) => {
    const [session, analysis] = await Promise.all([
      ctx.runQuery(api.sessions.getSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.analyses.getAnalysis, { analysisId: args.analysisId }),
    ]);

    const sessionContext = buildSessionContext(
      session.sport,
      session.requestedSections,
      analysis.twelveLabsResult ?? undefined
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

    return await ctx.runMutation(api.gemini.saveFeedback, {
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
  handler: async (ctx, args) => {
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
    await ctx.runMutation(api.gemini.saveMessage, {
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
    await ctx.runMutation(api.gemini.saveMessage, {
      sessionId: args.sessionId,
      role: "model",
      content: reply,
    });

    return reply;
  },
});
