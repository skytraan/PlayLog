import { api, callApi, type Id } from "@/lib/api";
import type { TaskPollResult, VideoIndexResult } from "./types";

/**
 * Trigger TwelveLabs indexing for a video already in R2 storage.
 * The indexVideo action presigns a read URL on the server side and hands it to
 * TwelveLabs — same flow as the old Convex setup, just over a different bucket.
 */
export async function uploadAndIndexVideo(params: {
  sessionId: Id<"sessions">;
  analysisId: Id<"analyses">;
  sport: string;
}): Promise<VideoIndexResult> {
  const indexId = await callApi(api.twelvelabs.getOrCreateIndex, {
    sport: params.sport,
  });

  const taskId = await callApi(api.twelvelabs.indexVideo, {
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
export async function pollUntilReady(params: {
  taskId: string;
  sessionId: Id<"sessions">;
  analysisId: Id<"analyses">;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<TaskPollResult> {
  const intervalMs = params.intervalMs ?? 8000;
  const timeoutMs = params.timeoutMs ?? 300_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await callApi(api.twelvelabs.getTaskStatus, {
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
