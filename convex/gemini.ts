"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const MAX_TL_CHARS = 1500;
const MAX_HISTORY_MSGS = 6;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ConvexError("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err);
      const is429 = msg.includes("429") || msg.includes("Too Many Requests");
      const isDailyLimit = msg.includes("PerDay") || msg.includes("per_day");
      if (!is429 || isDailyLimit || attempt === maxAttempts) throw err;

      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
      const waitMs = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1])) * 1000
        : 2 ** attempt * 5000;

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new ConvexError("Gemini API rate limit exceeded after retries");
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function buildSessionContext(
  sport: string,
  requestedSections: string[],
  twelveLabsResult?: string
): string {
  return [
    `Sport: ${sport}. Focus: ${requestedSections.join(", ")}.`,
    twelveLabsResult
      ? `Video analysis:\n${truncate(twelveLabsResult, MAX_TL_CHARS)}`
      : "No video analysis yet.",
  ].join("\n");
}

const COACH_SYSTEM_PROMPT = "Sports coach. Specific, actionable feedback using the video analysis. Reference timestamps. Plain language.";

// ─── Actions ─────────────────────────────────────────────────────────────────

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
      analysis.twelveLabsResult ?? undefined
    );

    const prompt = `${sessionContext}

Respond with ONLY a JSON object, no markdown, no explanation:
{"summary":"2-3 sentence assessment","strengths":["strength with timestamp"],"improvements":["issue — timestamp — fix"],"drills":["drill per improvement"]}`;

    let raw: string;
    try {
      const ai = getClient();
      const result = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: prompt,
          config: {
            systemInstruction: COACH_SYSTEM_PROMPT,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );
      raw = result.text ?? "";
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
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      throw new ConvexError(`Failed to parse Gemini feedback response: ${raw.slice(0, 200)}`);
    }

    return await ctx.runMutation(api.feedback.saveFeedback, {
      sessionId: args.sessionId,
      analysisId: args.analysisId,
      summary: parsed.summary,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      drills: parsed.drills,
    });
  },
});

export const askCoach = action({
  args: {
    sessionId: v.id("sessions"),
    userMessage: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    if (!args.userMessage.trim()) {
      throw new ConvexError("message cannot be empty");
    }

    const [session, history, latestFeedback, latestAnalysis] = await Promise.all([
      ctx.runQuery(api.sessions.getSession, { sessionId: args.sessionId }),
      ctx.runQuery(api.messages.getRecentMessages, {
        sessionId: args.sessionId,
        limit: MAX_HISTORY_MSGS,
      }),
      ctx.runQuery(api.feedback.getLatestFeedback, { sessionId: args.sessionId }),
      ctx.runQuery(api.analyses.getLatestAnalysis, { sessionId: args.sessionId }),
    ]);

    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.userMessage.trim(),
    });

    const systemContext = latestFeedback
      ? `Sport: ${session.sport}. Focus: ${session.requestedSections.join(", ")}.\nSummary: ${latestFeedback.summary}`
      : buildSessionContext(
          session.sport,
          session.requestedSections,
          latestAnalysis?.twelveLabsResult ?? undefined
        );

    let reply: string;
    try {
      const ai = getClient();
      const chat = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: `${COACH_SYSTEM_PROMPT}\n\n${systemContext}`,
          maxOutputTokens: 250,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
        history: history.map((msg: { role: "user" | "model"; content: string }) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
      });

      const result = await withRetry(() =>
        chat.sendMessage({ message: args.userMessage.trim() })
      );
      reply = result.text ?? "";
    } catch (err) {
      throw new ConvexError(`Gemini API error: ${String(err)}`);
    }

    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "model",
      content: reply,
    });

    return reply;
  },
});
