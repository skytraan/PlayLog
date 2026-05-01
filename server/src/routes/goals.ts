import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapGoal } from "../db/mappers.js";
import { ApiError, authedRpc } from "../lib/route.js";

export const goals = new Hono();

goals.post(
  "/getGoal",
  authedRpc(z.object({}), async (_args, { userId }) => {
    const rows = await sql`
      SELECT * FROM goals WHERE user_id = ${userId} LIMIT 1
    `;
    return rows.length === 0 ? null : mapGoal(rows[0]!);
  })
);

const SetArgs = z.object({
  targetOvr: z.number(),
  deadline: z.string(),
});

// Upsert by user — keeps Convex's "one goal per user" semantics.
goals.post(
  "/setGoal",
  authedRpc(SetArgs, async ({ targetOvr, deadline }, { userId }) => {
    if (targetOvr < 1 || targetOvr > 100) {
      throw new ApiError("targetOvr must be between 1 and 100");
    }
    if (!deadline) throw new ApiError("deadline is required");

    const now = Date.now();
    const existing = await sql`
      SELECT id FROM goals WHERE user_id = ${userId} LIMIT 1
    `;

    if (existing.length > 0) {
      const id = existing[0]!.id as string;
      await sql`
        UPDATE goals
        SET target_ovr = ${targetOvr}, deadline = ${deadline}, updated_at = ${now}
        WHERE id = ${id}
      `;
      return id;
    }

    const [row] = await sql`
      INSERT INTO goals (user_id, target_ovr, deadline, created_at, updated_at)
      VALUES (${userId}, ${targetOvr}, ${deadline}, ${now}, ${now})
      RETURNING id
    `;
    return row!.id as string;
  })
);
