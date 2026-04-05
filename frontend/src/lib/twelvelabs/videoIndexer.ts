import { ConvexReactClient } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { TaskPollResult, VideoIndexResult } from "./types";

/**
 * Trigger TwelveLabs indexing for a video already in Convex storage.
 * The video is fetched directly by the indexVideo action via its storage URL.
 */
export async function uploadAndIndexVideo(
  convex: ConvexReactClient,
  params: {
    sessionId: Id<"sessions">;
    analysisId: Id<"analyses">;
    sport: string;
  }
): Promise<VideoIndexResult> {
  const indexId = await convex.action(api.twelvelabs.getOrCreateIndex, {
    sport: params.sport,
  });

  const taskId = await convex.action(api.twelvelabs.indexVideo, {
    sessionId: params.sessionId,
    analysisId: params.analysisId,
    indexId,
  });

  return {
    taskId,
    sessionId: params.sessionId,
    analysisId: params.analysisId,
  };
}

/**
 * Poll TwelveLabs task status until indexing completes or fails.
 */
export async function pollUntilReady(
  convex: ConvexReactClient,
  params: {
    taskId: string;
    sessionId: Id<"sessions">;
    analysisId: Id<"analyses">;
    intervalMs?: number;
    timeoutMs?: number;
  }
): Promise<TaskPollResult> {
  const intervalMs = params.intervalMs ?? 8000;
  const timeoutMs = params.timeoutMs ?? 300_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await convex.action(api.twelvelabs.getTaskStatus, {
      taskId: params.taskId,
      sessionId: params.sessionId,
      analysisId: params.analysisId,
    });

    if (result.status === "ready" || result.status === "failed") {
      return result as TaskPollResult;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`TwelveLabs indexing timed out after ${timeoutMs}ms`);
}
