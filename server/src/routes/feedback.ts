import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapFeedback } from "../db/mappers.js";
import { ApiError, rpc } from "../lib/route.js";

export const feedback = new Hono();

const SaveArgs = z.object({
  sessionId: z.string(),
  analysisId: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  drills: z.array(z.string()),
});

feedback.post(
  "/saveFeedback",
  rpc(SaveArgs, async (a) => {
    const sess = await sql`SELECT 1 FROM sessions WHERE id = ${a.sessionId}`;
    if (sess.length === 0) {
      throw new ApiError(`Session ${a.sessionId} not found`, 404);
    }
    const [row] = await sql`
      INSERT INTO feedback (
        session_id, analysis_id, summary, strengths, improvements, drills, created_at
      ) VALUES (
        ${a.sessionId},
        ${a.analysisId},
        ${a.summary},
        ${sql.array(a.strengths)},
        ${sql.array(a.improvements)},
        ${sql.array(a.drills)},
        ${Date.now()}
      )
      RETURNING id
    `;
    return row!.id as string;
  })
);

const ByIdArgs = z.object({ feedbackId: z.string() });

feedback.post(
  "/getFeedback",
  rpc(ByIdArgs, async ({ feedbackId }) => {
    const rows = await sql`SELECT * FROM feedback WHERE id = ${feedbackId}`;
    if (rows.length === 0) {
      throw new ApiError(`Feedback ${feedbackId} not found`, 404);
    }
    return mapFeedback(rows[0]!);
  })
);

const BySessionArgs = z.object({ sessionId: z.string() });

feedback.post(
  "/getLatestFeedback",
  rpc(BySessionArgs, async ({ sessionId }) => {
    const rows = await sql`
      SELECT * FROM feedback
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows.length === 0 ? null : mapFeedback(rows[0]!);
  })
);
