import { Hono } from "hono";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "../db/client.js";
import { mapAnalysis, mapFeedback, mapMessage, mapSession } from "../db/mappers.js";
import { ApiError, authedRpc } from "../lib/route.js";
import { env } from "../lib/env.js";
import {
  buildTimeline,
  formatTimelineForPrompt,
  snapTimestampsInText,
  type TimelineMoment,
} from "../lib/timeline.js";

export const coach = new Hono();

const MODEL = "claude-haiku-4-5";
const MAX_TL_CHARS = 1500;
const MAX_HISTORY_MSGS = 6;

function getClient() {
  if (!env.anthropicApiKey) throw new ApiError("ANTHROPIC_API_KEY is not set", 500);
  return new Anthropic({ apiKey: env.anthropicApiKey });
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
  "You are a sports coach. Give specific, actionable feedback using the video analysis. Reference timestamps. Plain language.";

// Convert an Anthropic SDK error into an ApiError. The SDK throws typed
// classes (RateLimitError / AuthenticationError / APIError), each with a
// useful .status — preserve that so the frontend gets the right HTTP code.
function toApiError(err: unknown, fallbackMsg: string): ApiError {
  if (err instanceof Anthropic.APIError) {
    return new ApiError(`${fallbackMsg}: ${err.message}`, err.status ?? 502);
  }
  return new ApiError(`${fallbackMsg}: ${String(err)}`, 502);
}

// --- generateFeedback ------------------------------------------------------
//
// One-shot structured generation. We use messages.parse() with a Zod schema
// so Claude's response is validated against the shape we need — no fragile
// "regex out the JSON object" step like the old Gemini path had.

const FeedbackArgs = z.object({
  sessionId: z.string(),
  analysisId: z.string(),
});

const FeedbackSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  drills: z.array(z.string()),
});

coach.post(
  "/generateFeedback",
  authedRpc(FeedbackArgs, async ({ sessionId, analysisId }) => {
    // Idempotency: if feedback already exists for this analysis, return it
    // without re-spending Anthropic tokens. The DB-side UNIQUE constraint on
    // feedback.analysis_id is the authoritative guard against races; this
    // check is just the cheap path for the 99% case.
    const existing = await sql`
      SELECT id FROM feedback WHERE analysis_id = ${analysisId} LIMIT 1
    `;
    if (existing.length > 0) return existing[0]!.id as string;

    const [sessRows, anaRows] = await Promise.all([
      sql`SELECT * FROM sessions WHERE id = ${sessionId}`,
      sql`SELECT * FROM analyses WHERE id = ${analysisId}`,
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

    // Anchor Claude to a known set of moments. Pose key-frames (frame-accurate)
    // win over Pegasus-mentioned timestamps; Claude is forbidden from inventing
    // numbers, and its output is post-snapped to the nearest authoritative moment.
    const timeline = buildTimeline(analysis.poseAnalysis, analysis.twelveLabsResult);
    const authoritativeSeconds = timeline.map((m) => m.seconds);
    const timelineForPrompt = formatTimelineForPrompt(timeline);

    const userPrompt = `${sessionContext}

Authoritative timeline (the ONLY moments you may reference):
${timelineForPrompt}

The timeline includes BEST and WORST exemplars per phase (with scores). Coach
the contrast: when a phase has both, your feedback for that phase MUST
reference both moments — what made the best work and what broke down in the
worst. A coach who only celebrates highlights is a flatterer; a coach who
only lists problems is discouraging. Do both, in the same beat.

Generate coaching feedback as JSON: a 2-3 sentence summary, an array of strengths (each with a timestamp from the timeline above), an array of improvements (each formatted as "issue — timestamp — fix" and citing the WORST timestamp where applicable), and an array of drills (one per improvement).

Hard rule: every timestamp you use MUST come from the timeline above, written in m:ss format. If a moment isn't in the timeline, describe it without a timestamp rather than guess.`;

    let parsed: z.infer<typeof FeedbackSchema>;
    try {
      const result = await getClient().messages.parse({
        model: MODEL,
        max_tokens: 1024,
        system: COACH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                improvements: { type: "array", items: { type: "string" } },
                drills: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "strengths", "improvements", "drills"],
              additionalProperties: false,
            },
          },
        },
      });

      if (!result.parsed_output) {
        throw new ApiError("Claude returned no structured output", 502);
      }
      parsed = FeedbackSchema.parse(result.parsed_output);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw toApiError(err, "Anthropic API error");
    }

    // Snap any timestamps Claude emitted to the nearest authoritative moment.
    // This catches the cases where the prompt constraint wasn't followed
    // (Claude rounded "0:05" to "0:07", or invented a moment Pegasus mentioned
    // approximately).
    const snap = (s: string) => snapTimestampsInText(s, authoritativeSeconds).text;
    const summary = snap(parsed.summary);
    const strengths = parsed.strengths.map(snap);
    const improvements = parsed.improvements.map(snap);
    const drills = parsed.drills.map(snap);

    // ON CONFLICT (analysis_id): if a concurrent request already inserted
    // feedback between our short-circuit check above and this INSERT, return
    // the existing row's id rather than failing. The no-op SET on the
    // conflict key forces RETURNING to emit the existing row.
    const [row] = await sql`
      INSERT INTO feedback (
        session_id, analysis_id, summary, strengths, improvements, drills, created_at
      ) VALUES (
        ${sessionId}, ${analysisId}, ${summary},
        ${sql.array(strengths)},
        ${sql.array(improvements)},
        ${sql.array(drills)},
        ${Date.now()}
      )
      ON CONFLICT (analysis_id) DO UPDATE
        SET analysis_id = EXCLUDED.analysis_id
      RETURNING id
    `;
    return row!.id as string;
  })
);

// --- askCoach --------------------------------------------------------------
//
// Multi-turn chat. We send the (capped) message history as alternating
// user/assistant turns and append the new user message at the end. The
// Anthropic API uses "assistant" where Convex/our DB used "model" — translate
// at the boundary.

const AskArgs = z.object({
  sessionId: z.string(),
  userMessage: z.string(),
});

coach.post(
  "/askCoach",
  authedRpc(AskArgs, async ({ sessionId, userMessage }) => {
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

    const trimmed = userMessage.trim();

    await sql`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (${sessionId}, 'user', ${trimmed}, ${Date.now()})
    `;

    // Same grounding the feedback path uses — pose key-frames + Pegasus
    // anchors, deduped. Constraint goes in the system prompt so it's enforced
    // across every chat turn, and the reply is post-snapped before saving.
    const timeline = buildTimeline(
      latestAnalysis?.poseAnalysis,
      latestAnalysis?.twelveLabsResult
    );
    const authoritativeSeconds = timeline.map((m: TimelineMoment) => m.seconds);
    const timelineSection = timeline.length > 0
      ? `\n\nAuthoritative timeline (the ONLY moments you may reference; m:ss). Entries tagged BEST/WORST are exemplars of the same phase — when both appear, contrast them in your reply rather than picking one.\n${formatTimelineForPrompt(timeline)}\n\nHard rule: every timestamp you use MUST come from the timeline above. If a moment isn't in the timeline, describe it without a timestamp.`
      : "";

    const systemContext = latestFeedback
      ? `Sport: ${session.sport}. Focus: ${session.requestedSections.join(", ")}.\nLatest summary: ${latestFeedback.summary}`
      : buildSessionContext(
          session.sport,
          session.requestedSections,
          latestAnalysis?.twelveLabsResult ?? undefined
        );

    let reply: string;
    try {
      const messages: Anthropic.MessageParam[] = [
        ...history.map<Anthropic.MessageParam>((m) => ({
          role: m.role === "model" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: trimmed },
      ];

      const result = await getClient().messages.create({
        model: MODEL,
        max_tokens: 512,
        system: `${COACH_SYSTEM_PROMPT}\n\n${systemContext}${timelineSection}`,
        messages,
      });

      reply = result.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    } catch (err) {
      throw toApiError(err, "Anthropic API error");
    }

    const groundedReply = authoritativeSeconds.length > 0
      ? snapTimestampsInText(reply, authoritativeSeconds).text
      : reply;

    await sql`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (${sessionId}, 'model', ${groundedReply}, ${Date.now()})
    `;

    return groundedReply;
  })
);
