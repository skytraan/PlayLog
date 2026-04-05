import { ConvexReactClient } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { TaskPollResult, VideoIndexResult } from "./types";

/**
 * Upload a video blob to Convex storage, then trigger TwelveLabs indexing.
 * Returns the TwelveLabs task ID along with the session/analysis IDs.
 */
export async function uploadAndIndexVideo(
  convex: ConvexReactClient,
  params: {
    videoBlob: Blob;
    sessionId: Id<"sessions">;
    analysisId: Id<"analyses">;
    sport: string;
  }
): Promise<VideoIndexResult> {
  // Step 1: get a short-lived upload URL from Convex storage
  const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});

  // Step 2: POST the video blob directly to Convex storage
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": params.videoBlob.type },
    body: params.videoBlob,
  });

  if (!uploadRes.ok) {
    throw new Error(`Video upload failed: ${uploadRes.statusText}`);
  }

  // Step 3: get or create a TwelveLabs index for this sport
  const indexId = await convex.action(api.twelvelabs.getOrCreateIndex, {
    sport: params.sport,
  });

  // Step 4: trigger TwelveLabs indexing — returns the task ID
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
 * Resolves with the final status and video ID when done.
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
  const intervalMs = params.intervalMs ?? 3000;
  const timeoutMs = params.timeoutMs ?? 300_000; // 5 min default
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
