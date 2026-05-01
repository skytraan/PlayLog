// Tiny RPC helper. Every route accepts a JSON body, validates it with zod,
// runs a handler, and serializes the result. Errors thrown as ApiError become
// structured `{ error }` responses with the right HTTP status — anything else
// is logged and returned as a 500 with a generic message.

import type { Context } from "hono";
import type { ZodSchema } from "zod";
import { ApiError, isApiError } from "./errors.js";

export function rpc<TArgs, TResult>(
  schema: ZodSchema<TArgs>,
  handler: (args: TArgs) => Promise<TResult>
): (c: Context) => Promise<Response> {
  return async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        400
      );
    }

    try {
      const result = await handler(parsed.data);
      return c.json(result === undefined ? null : result);
    } catch (err) {
      if (isApiError(err)) {
        return c.json({ error: err.message }, err.status as 400 | 404 | 500);
      }
      console.error("[rpc] unhandled:", err);
      return c.json({ error: "internal error" }, 500);
    }
  };
}

export { ApiError };
