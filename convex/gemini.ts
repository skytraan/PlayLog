"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MAX_TL_CHARS = 1500;
const MAX_HISTORY_MSGS = 6;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ConvexError("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
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

// Short, directive system prompt — no filler
const COACH_SYSTEM_PROMPT = "Sports coach. Specific, actionable feedback using the video analysis. Reference timestamps. Plain language.";

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * One-shot structured feedback after video analysis completes.
 * responseMimeType enforces JSON output natively — no format instructions needed
 * in the prompt, no regex parsing needed on the response.
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
      analysis.twelveLabsResult ?? undefined
    );

    // Prompt describes *what* to produce — not *how* to format it.
    // Format is enforced by responseMimeType + stopSequences below.
    const prompt = `${sessionContext}

Feedback fields:
- summary: 2-3 sentence assessment
- strengths: what the player does well (include timestamps)
- improvements: issue + timestamp + fix
- drills: one drill per improvement`;

    let raw: string;
    try {
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: COACH_SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 400,
          temperature: 0.2,
          stopSequences: ["\n}"],
        },
      });
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
      parsed = JSON.parse(raw);
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
    });
  },
});

/**
 * Conversational "Ask Your Coach" action.
 * History capped at MAX_HISTORY_MSGS. When feedback exists, system context
 * is just the summary — avoids resending the full TwelveLabs result every turn.
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
      const genAI = getClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `${COACH_SYSTEM_PROMPT}\n\n${systemContext}`,
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.5,
        },
      });

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

    await ctx.runMutation(api.messages.saveMessage, {
      sessionId: args.sessionId,
      role: "model",
      content: reply,
    });

    return reply;
  },
});
