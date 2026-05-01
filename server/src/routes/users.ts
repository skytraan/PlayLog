import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapUser } from "../db/mappers.js";
import { ApiError, rpc } from "../lib/route.js";

export const users = new Hono();

const CreateUserArgs = z.object({
  name: z.string(),
  email: z.string(),
  sports: z.array(z.string()),
});

users.post(
  "/createUser",
  rpc(CreateUserArgs, async ({ name, email, sports }) => {
    if (!name.trim()) throw new ApiError("name is required");
    if (!email.trim() || !email.includes("@")) {
      throw new ApiError("valid email is required");
    }
    if (sports.length === 0) {
      throw new ApiError("at least one sport must be selected");
    }

    const trimmedEmail = email.trim();
    const existing = await sql`
      SELECT id FROM users WHERE email = ${trimmedEmail} LIMIT 1
    `;
    if (existing.length > 0) return existing[0]!.id as string;

    const [row] = await sql`
      INSERT INTO users (name, email, sports, created_at)
      VALUES (${name.trim()}, ${trimmedEmail}, ${sql.array(sports)}, ${Date.now()})
      RETURNING id
    `;
    return row!.id as string;
  })
);

const ByIdArgs = z.object({ userId: z.string() });

users.post(
  "/getUser",
  rpc(ByIdArgs, async ({ userId }) => {
    const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
    if (rows.length === 0) throw new ApiError(`User ${userId} not found`, 404);
    return mapUser(rows[0]!);
  })
);

// findUser returns null instead of throwing — used by the frontend to verify a
// locally cached profile still exists in the DB.
users.post(
  "/findUser",
  rpc(ByIdArgs, async ({ userId }) => {
    const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
    return rows.length === 0 ? null : mapUser(rows[0]!);
  })
);

const ByEmailArgs = z.object({ email: z.string() });

users.post(
  "/getUserByEmail",
  rpc(ByEmailArgs, async ({ email }) => {
    const rows = await sql`
      SELECT * FROM users WHERE email = ${email.trim()} LIMIT 1
    `;
    return rows.length === 0 ? null : mapUser(rows[0]!);
  })
);
