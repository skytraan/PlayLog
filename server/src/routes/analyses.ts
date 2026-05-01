import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapAnalysis } from "../db/mappers.js";
import { ApiError, rpc } from "../lib/route.js";

export const analyses = new Hono();

const CreateArgs = z.object({ sessionId: z.string() });

analyses.post(
  "/createAnalysis",
  rpc(CreateArgs, async ({ sessionId }) => {
    const sess = await sql`SELECT 1 FROM sessions WHERE id = ${sessionId}`;
    if (sess.length === 0) {
      throw new ApiError(`Session ${sessionId} not found`, 404);
    }
    const [row] = await sql`
      INSERT INTO analyses (session_id, created_at)
      VALUES (${sessionId}, ${Date.now()})
      RETURNING id
    `;
    return row!.id as string;
  })
);

const UpdateArgs = z.object({
  analysisId: z.string(),
  twelveLabsIndexId: z.string().optional(),
  twelveLabsVideoId: z.string().optional(),
  twelveLabsResult: z.string().optional(),
  poseAnalysis: z.string().optional(),
  overallScore: z.number().optional(),
  technique: z.string().optional(),
});

// Only patches fields that were explicitly set — same semantics as Convex's
// ctx.db.patch with `Object.entries(...).filter(...)`. Empty patches are no-ops.
analyses.post(
  "/updateAnalysis",
  rpc(UpdateArgs, async (args) => {
    const exists = await sql`
      SELECT 1 FROM analyses WHERE id = ${args.analysisId}
    `;
    if (exists.length === 0) {
      throw new ApiError(`Analysis ${args.analysisId} not found`, 404);
    }

    const fields: Record<string, unknown> = {};
    if (args.twelveLabsIndexId !== undefined) fields.twelve_labs_index_id = args.twelveLabsIndexId;
    if (args.twelveLabsVideoId !== undefined) fields.twelve_labs_video_id = args.twelveLabsVideoId;
    if (args.twelveLabsResult !== undefined) fields.twelve_labs_result = args.twelveLabsResult;
    if (args.poseAnalysis !== undefined) fields.pose_analysis = args.poseAnalysis;
    if (args.overallScore !== undefined) fields.overall_score = args.overallScore;
    if (args.technique !== undefined) fields.technique = args.technique;

    const cols = Object.keys(fields);
    if (cols.length === 0) return null;

    await sql`
      UPDATE analyses SET ${sql(fields)}
      WHERE id = ${args.analysisId}
    `;
    return null;
  })
);

const ByIdArgs = z.object({ analysisId: z.string() });

analyses.post(
  "/getAnalysis",
  rpc(ByIdArgs, async ({ analysisId }) => {
    const rows = await sql`SELECT * FROM analyses WHERE id = ${analysisId}`;
    if (rows.length === 0) {
      throw new ApiError(`Analysis ${analysisId} not found`, 404);
    }
    return mapAnalysis(rows[0]!);
  })
);

const BySessionArgs = z.object({ sessionId: z.string() });

analyses.post(
  "/getLatestAnalysis",
  rpc(BySessionArgs, async ({ sessionId }) => {
    const rows = await sql`
      SELECT * FROM analyses
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows.length === 0 ? null : mapAnalysis(rows[0]!);
  })
);
