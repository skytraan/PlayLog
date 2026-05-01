import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { users } from "./routes/users.js";
import { sessions } from "./routes/sessions.js";
import { analyses } from "./routes/analyses.js";
import { messages } from "./routes/messages.js";
import { feedback } from "./routes/feedback.js";
import { goals } from "./routes/goals.js";
import { badges } from "./routes/badges.js";
import { storage } from "./routes/storage.js";
import { twelvelabs } from "./routes/twelvelabs.js";
import { coach } from "./routes/coach.js";

export const app = new Hono();

app.use("*", cors({ origin: env.corsOrigin === "*" ? "*" : env.corsOrigin.split(",") }));

app.use("*", async (c, next) => {
  const reqId = c.req.header("x-request-id") ?? randomUUID();
  const reqLogger = logger.child({ reqId });
  c.set("reqId", reqId);
  c.set("logger", reqLogger);
  const start = Date.now();
  await next();
  reqLogger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durMs: Date.now() - start,
  });
});

app.get("/health", (c) => c.json({ ok: true }));

// Mount each module under /api/<module>. Endpoint names exactly match the
// Convex query/mutation/action names so the frontend layer can address them
// the same way (api.users.createUser, api.sessions.getSession, etc).
app.route("/api/users",      users);
app.route("/api/sessions",   sessions);
app.route("/api/analyses",   analyses);
app.route("/api/messages",   messages);
app.route("/api/feedback",   feedback);
app.route("/api/goals",      goals);
app.route("/api/badges",     badges);
app.route("/api/storage",    storage);
app.route("/api/twelvelabs", twelvelabs);
app.route("/api/coach",      coach);

// In test/import mode the entry file is loaded but we skip listen.
if (process.env.NODE_ENV !== "test" && !process.env.SKIP_LISTEN) {
  serve({ fetch: app.fetch, port: env.port }, (info) => {
    logger.info({ port: info.port }, "playlog server ready");
  });
}
