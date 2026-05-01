import { Hono } from "hono";
import { z } from "zod";
import { authedRpc } from "../lib/route.js";
import * as svc from "../services/twelvelabs.js";

export const twelvelabs = new Hono();

twelvelabs.post(
  "/analyzeDirect",
  authedRpc(
    z.object({
      sessionId: z.string(),
      analysisId: z.string(),
      prompt: z.string(),
    }),
    (args) => svc.analyzeDirect(args)
  )
);
