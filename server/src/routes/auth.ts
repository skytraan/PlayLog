// Authentication endpoints. Issues bearer tokens (HS256 JWT) that downstream
// authedRpc-protected routes verify on every request.
//
// /login    — public. Email lookup → token + user. Used by the demo
//             "sign in as" picker on the frontend.
// /signup   — public. Creates a user (or returns the existing one for that
//             email) and issues a token. Wraps users.createUser so the
//             frontend doesn't need a separate token-mint round trip.
// /me       — authed. Returns the user the bearer token resolves to.

import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { mapUser } from "../db/mappers.js";
import { ApiError, authedRpc, rpc } from "../lib/route.js";
import { signToken } from "../lib/auth.js";

export const auth = new Hono();

const LoginArgs = z.object({ email: z.string() });

auth.post(
  "/login",
  rpc(LoginArgs, async ({ email }) => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) throw new ApiError("valid email is required");

    const rows = await sql`SELECT * FROM users WHERE email = ${trimmed} LIMIT 1`;
    if (rows.length === 0) throw new ApiError("no account for that email", 404);

    const user = mapUser(rows[0]!);
    const token = await signToken(user._id);
    return { token, user };
  })
);

const SignupArgs = z.object({
  name: z.string(),
  email: z.string(),
  sports: z.array(z.string()),
});

auth.post(
  "/signup",
  rpc(SignupArgs, async ({ name, email, sports }) => {
    if (!name.trim()) throw new ApiError("name is required");
    if (!email.trim() || !email.includes("@")) {
      throw new ApiError("valid email is required");
    }
    if (sports.length === 0) {
      throw new ApiError("at least one sport must be selected");
    }

    const trimmedEmail = email.trim();
    const existing = await sql`
      SELECT * FROM users WHERE email = ${trimmedEmail} LIMIT 1
    `;
    let user;
    if (existing.length > 0) {
      user = mapUser(existing[0]!);
    } else {
      const [row] = await sql`
        INSERT INTO users (name, email, sports, created_at)
        VALUES (${name.trim()}, ${trimmedEmail}, ${sql.array(sports)}, ${Date.now()})
        RETURNING *
      `;
      user = mapUser(row!);
    }

    const token = await signToken(user._id);
    return { token, user };
  })
);

auth.post(
  "/me",
  authedRpc(z.object({}), async (_args, { userId }) => {
    const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
    if (rows.length === 0) throw new ApiError("User not found", 404);
    return mapUser(rows[0]!);
  })
);
