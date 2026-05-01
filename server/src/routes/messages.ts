import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapMessage } from "../db/mappers.js";
import { authedRpc } from "../lib/route.js";

export const messages = new Hono();

const SaveArgs = z.object({
  sessionId: z.string(),
  role: z.enum(["user", "model"]),
  content: z.string(),
});

messages.post(
  "/saveMessage",
  authedRpc(SaveArgs, async ({ sessionId, role, content }) => {
    const [row] = await sql`
      INSERT INTO messages (session_id, role, content, created_at)
      VALUES (${sessionId}, ${role}, ${content}, ${Date.now()})
      RETURNING id
    `;
    return row!.id as string;
  })
);

const SessionArgs = z.object({ sessionId: z.string() });

messages.post(
  "/getMessages",
  authedRpc(SessionArgs, async ({ sessionId }) => {
    const rows = await sql`
      SELECT * FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;
    return rows.map(mapMessage);
  })
);

const RecentArgs = z.object({
  sessionId: z.string(),
  limit: z.number().int().positive(),
});

// Mirrors getRecentMessages — pull the newest N then reverse to chronological
// so callers can hand the array straight to a chat history.
messages.post(
  "/getRecentMessages",
  authedRpc(RecentArgs, async ({ sessionId, limit }) => {
    const rows = await sql`
      SELECT * FROM messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(mapMessage).reverse();
  })
);
