import { Hono } from "hono";
import { z } from "zod";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { sql } from "../db/client.js";
import { mapAnalysis, mapFeedback, mapMessage, mapSession } from "../db/mappers.js";
import { ApiError, rpc } from "../lib/route.js";
import { env } from "../lib/env.js";

export const gemini = new Hono();

const MAX_TL_CHARS = 1500;
const MAX_HISTORY_MSGS = 6;

function getClient() {
  if (!env.geminiApiKey) throw new ApiError("GEMINI_API_KEY is not set", 500);
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
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
        ? Math.ceil(parseFloat(retryMatch[1]!)) * 1000
        : 2 ** attempt * 5000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new ApiError("Gemini API rate limit exceeded after retries", 502);
}

const truncate = (text: string, max: number) =>
  text.length > max ? text.slice(0, max) : text;

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

const COACH_SYSTEM_PROMPT =
  "Sports coach. Specific, actionable feedback using the video analysis. Reference timestamps. Plain language.";

// --- generateFeedback ------------------------------------------------------

const FeedbackArgs = z.object({
  sessionId: z.string(),
  analysisId: z.string(),
});

gemini.post(
  "/generateFeedback",
  rpc(FeedbackArgs, async ({ sessionId, analysisId }) => {
    const [sessRows, anaRows] = await Promise.all([
      sql`SELECT * FROM sessions  WHERE id = ${sessionId}`,
      sql`SELECT * FROM analyses  WHERE id = ${analysisId}`,
    ]);
    if (sessRows.length === 0) throw new ApiError(`Session ${sessionId} not found`, 404);
    if (anaRows.length === 0)  throw new ApiError(`Analysis ${analysisId} not found`, 404);

    const session = mapSession(sessRows[0]!);
    const analysis = mapAnalysis(anaRows[0]!);

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
      throw new ApiError(`Gemini API error: ${String(err)}`, 502);
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
      throw new ApiError(`Failed to parse Gemini feedback response: ${raw.slice(0, 200)}`);
    }

    const [row] = await sql`
      INSERT INTO feedback (
        session_id, analysis_id, summary, strengths, improvements, drills, created_at
      ) VALUES (
        ${sessionId}, ${analysisId}, ${parsed.summary},
        ${sql.array(parsed.strengths)},
        ${sql.array(parsed.improvements)},
        ${sql.array(parsed.drills)},
        ${Date.now()}
      )
      RETURNING id
    `;
    return row!.id as string;
  })
);

// --- askCoach --------------------------------------------------------------

const AskArgs = z.object({
  sessionId: z.string(),
  userMessage: z.string(),
});

gemini.post(
  "/askCoach",
  rpc(AskArgs, async ({ sessionId, userMessage }) => {
    if (!userMessage.trim()) throw new ApiError("message cannot be empty");

    const [sessRows, historyRows, latestFbRows, latestAnaRows] = await Promise.all([
      sql`SELECT * FROM sessions WHERE id = ${sessionId}`,
      sql`
        SELECT * FROM messages
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC
        LIMIT ${MAX_HISTORY_MSGS}
      `,
      sql`
        SELECT * FROM feedback
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC LIMIT 1
      `,
      sql`
        SELECT * FROM analyses
        WHERE session_id = ${sessionId}
        ORDER BY created_at DESC LIMIT 1
      `,
    ]);
    if (sessRows.length === 0) throw new ApiError(`Session ${sessionId} not found`, 404);

    const session = mapSession(sessRows[0]!);
    const history = historyRows.map(mapMessage).reverse();
    const latestFeedback = latestFbRows.length > 0 ? mapFeedback(latestFbRows[0]!) : null;
    const latestAnalysis = latestAnaRows.length > 0 ? mapAnalysis(latestAnaRows[0]!) : null;

    await sql`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (${sessionId}, 'user', ${userMessage.trim()}, ${Date.now()})
    `;

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
        history: history.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
      });
      const result = await withRetry(() =>
        chat.sendMessage({ message: userMessage.trim() })
      );
      reply = result.text ?? "";
    } catch (err) {
      throw new ApiError(`Gemini API error: ${String(err)}`, 502);
    }

    await sql`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (${sessionId}, 'model', ${reply}, ${Date.now()})
    `;

    return reply;
  })
);
