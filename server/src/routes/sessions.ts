import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import {
  mapAnalysis,
  mapFeedback,
  mapSession,
} from "../db/mappers.js";
import { ApiError, rpc } from "../lib/route.js";

export const sessions = new Hono();

const StatusEnum = z.enum(["uploading", "processing", "complete", "error"]);

const CreateSessionArgs = z.object({
  userId: z.string(),
  sport: z.string(),
  videoStorageId: z.string(),
  requestedSections: z.array(z.string()),
});

sessions.post(
  "/createSession",
  rpc(CreateSessionArgs, async (args) => {
    if (!args.sport.trim()) throw new ApiError("sport is required");
    if (args.requestedSections.length === 0) {
      throw new ApiError("at least one section must be requested");
    }

    const userExists = await sql`
      SELECT 1 FROM users WHERE id = ${args.userId}
    `;
    if (userExists.length === 0) {
      throw new ApiError(`User ${args.userId} not found`, 404);
    }

    const [row] = await sql`
      INSERT INTO sessions (
        user_id, sport, video_storage_id, requested_sections, status, created_at
      ) VALUES (
        ${args.userId},
        ${args.sport.trim()},
        ${args.videoStorageId},
        ${sql.array(args.requestedSections)},
        'uploading',
        ${Date.now()}
      )
      RETURNING id
    `;
    return row!.id as string;
  })
);

const UpdateStatusArgs = z.object({
  sessionId: z.string(),
  status: StatusEnum,
  errorMessage: z.string().optional(),
});

sessions.post(
  "/updateSessionStatus",
  rpc(UpdateStatusArgs, async ({ sessionId, status, errorMessage }) => {
    const result =
      errorMessage === undefined
        ? await sql`
            UPDATE sessions SET status = ${status}
            WHERE id = ${sessionId}
            RETURNING id
          `
        : await sql`
            UPDATE sessions SET status = ${status}, error_message = ${errorMessage}
            WHERE id = ${sessionId}
            RETURNING id
          `;
    if (result.length === 0) {
      throw new ApiError(`Session ${sessionId} not found`, 404);
    }
    return null;
  })
);

const SessionIdArgs = z.object({ sessionId: z.string() });

sessions.post(
  "/getSession",
  rpc(SessionIdArgs, async ({ sessionId }) => {
    const rows = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (rows.length === 0) {
      throw new ApiError(`Session ${sessionId} not found`, 404);
    }
    return mapSession(rows[0]!);
  })
);

const UserIdArgs = z.object({ userId: z.string() });

sessions.post(
  "/listSessions",
  rpc(UserIdArgs, async ({ userId }) => {
    const rows = await sql`
      SELECT * FROM sessions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return rows.map(mapSession);
  })
);

// Mirrors convex sessions.listSessionsWithFeedback. Joins the latest feedback
// + latest analysis for each session in one round-trip via lateral subqueries.
sessions.post(
  "/listSessionsWithFeedback",
  rpc(UserIdArgs, async ({ userId }) => {
    const rows = await sql`
      SELECT
        s.*,
        (
          SELECT to_jsonb(f) FROM feedback f
          WHERE f.session_id = s.id
          ORDER BY f.created_at DESC LIMIT 1
        ) AS latest_feedback,
        (
          SELECT to_jsonb(a) FROM analyses a
          WHERE a.session_id = s.id
          ORDER BY a.created_at DESC LIMIT 1
        ) AS latest_analysis
      FROM sessions s
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
    `;

    return rows.map((r) => {
      const feedback = r.latest_feedback
        ? mapFeedback(r.latest_feedback as Record<string, unknown>)
        : null;
      const analysis = r.latest_analysis
        ? mapAnalysis(r.latest_analysis as Record<string, unknown>)
        : null;
      return {
        session: mapSession(r),
        feedback,
        overallScore: analysis?.overallScore ?? null,
        technique: analysis?.technique ?? null,
        poseAnalysis: analysis?.poseAnalysis ?? null,
      };
    });
  })
);
