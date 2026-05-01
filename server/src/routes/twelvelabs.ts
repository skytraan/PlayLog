import { Hono } from "hono";
import { z } from "zod";
import { rpc } from "../lib/route.js";
import * as svc from "../services/twelvelabs.js";

export const twelvelabs = new Hono();

twelvelabs.post(
  "/getOrCreateIndex",
  rpc(z.object({ sport: z.string() }), ({ sport }) => svc.getOrCreateIndex(sport))
);

twelvelabs.post(
  "/indexVideo",
  rpc(
    z.object({
      sessionId: z.string(),
      analysisId: z.string(),
      indexId: z.string(),
    }),
    (args) => svc.indexVideo(args)
  )
);

twelvelabs.post(
  "/getTaskStatus",
  rpc(
    z.object({
      taskId: z.string(),
      analysisId: z.string(),
      sessionId: z.string(),
    }),
    (args) => svc.getTaskStatus(args)
  )
);

twelvelabs.post(
  "/analyzeVideo",
  rpc(
    z.object({
      analysisId: z.string(),
      videoId: z.string(),
      prompt: z.string(),
    }),
    (args) => svc.analyzeVideo(args)
  )
);
