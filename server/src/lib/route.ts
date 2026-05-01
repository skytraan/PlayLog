// Tiny RPC helper. Every route accepts a JSON body, validates it with zod,
// runs a handler, and serializes the result. Errors thrown as ApiError become
// structured `{ error }` responses with the right HTTP status — anything else
// is logged and returned as a 500 with a generic message.

import type { Context } from "hono";
import type { ZodSchema } from "zod";
import { ApiError, isApiError } from "./errors.js";
import { logger as rootLogger } from "./logger.js";
import { bearerToken, verifyToken } from "./auth.js";

type StatusCode = 400 | 401 | 404 | 500;

function fail(c: Context, message: string, status: StatusCode): Response {
  return c.json({ error: message }, status);
}

async function parseBody<TArgs>(
  c: Context,
  schema: ZodSchema<TArgs>
): Promise<{ ok: true; data: TArgs } | { ok: false; res: Response }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      res: fail(c, parsed.error.issues.map((i) => i.message).join("; "), 400),
    };
  }
  return { ok: true, data: parsed.data };
}

async function dispatch<T>(
  c: Context,
  run: () => Promise<T>
): Promise<Response> {
  try {
    const result = await run();
    return c.json(result === undefined ? null : result);
  } catch (err) {
    if (isApiError(err)) {
      return fail(c, err.message, err.status as StatusCode);
    }
    const log = (c.get("logger") as typeof rootLogger | undefined) ?? rootLogger;
    log.error({ err }, "[rpc] unhandled error");
    return fail(c, "internal error", 500);
  }
}

// Public route: accepts a body, validates, runs the handler. No auth required.
export function rpc<TArgs, TResult>(
  schema: ZodSchema<TArgs>,
  handler: (args: TArgs) => Promise<TResult>
): (c: Context) => Promise<Response> {
  return async (c) => {
    const parsed = await parseBody(c, schema);
    if (!parsed.ok) return parsed.res;
    return dispatch(c, () => handler(parsed.data));
  };
}

// Authed route: rejects with 401 if there's no valid Bearer token, otherwise
// passes the verified userId to the handler as the second argument. Routes
// that previously took `userId` in the request body should pull it from
// `ctx.userId` here instead — never trust a userId from the wire.
export function authedRpc<TArgs, TResult>(
  schema: ZodSchema<TArgs>,
  handler: (args: TArgs, ctx: { userId: string }) => Promise<TResult>
): (c: Context) => Promise<Response> {
  return async (c) => {
    const token = bearerToken(c.req.header("authorization"));
    if (!token) return fail(c, "unauthenticated", 401);

    let userId: string;
    try {
      ({ userId } = verifyToken(token));
    } catch (err) {
      if (isApiError(err)) return fail(c, err.message, err.status as StatusCode);
      return fail(c, "unauthenticated", 401);
    }

    const parsed = await parseBody(c, schema);
    if (!parsed.ok) return parsed.res;
    return dispatch(c, () => handler(parsed.data, { userId }));
  };
}

export { ApiError };
