"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const BASE_URL = "https://api.twelvelabs.io/v1.3";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.TWELVELABS_API_KEY;
  if (!key) throw new ConvexError("TWELVELABS_API_KEY is not set");
  return key;
}

async function tlFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ConvexError(`TwelveLabs API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Create a TwelveLabs index for a sport (idempotent — returns existing if found).
 * Indexes are scoped per sport so videos are grouped logically.
 */
export const getOrCreateIndex = action({
  args: {
    sport: v.string(),
  },
  handler: async (_ctx, args): Promise<string> => {
    const indexName = `playlog-${args.sport.toLowerCase()}`;

    // Check if index already exists
    const list = (await tlFetch(`/indexes?name=${encodeURIComponent(indexName)}`)) as {
      data: { _id: string; name: string }[];
    };

    const existing = list.data.find((i) => i.name === indexName);
    if (existing) return existing._id;

    // Create new index with Pegasus video understanding enabled
    const created = (await tlFetch("/indexes", {
      method: "POST",
      body: JSON.stringify({
        name: indexName,
        engines: [
          {
            name: "pegasus1.2",
            options: ["visual", "conversation"],
          },
        ],
      }),
    })) as { _id: string };

    return created._id;
  },
});

/**
 * Upload a video from Convex storage to TwelveLabs for indexing.
 * Returns the TwelveLabs task ID — poll getTaskStatus to know when it's ready.
 */
export const indexVideo = action({
  args: {
    sessionId: v.id("sessions"),
    analysisId: v.id("analyses"),
    indexId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // Get a temporary public URL for the video from Convex storage
    const session = await ctx.runQuery(api.sessions.getSession, {
      sessionId: args.sessionId,
    });

    const videoUrl = await ctx.runQuery(api.storage.getVideoUrl, {
      storageId: session.videoStorageId,
    });

    if (!videoUrl) {
      throw new ConvexError("Could not retrieve video URL from storage");
    }

    // Submit video to TwelveLabs for indexing
    const task = (await tlFetch("/tasks", {
      method: "POST",
      body: JSON.stringify({
        index_id: args.indexId,
        video_url: videoUrl,
      }),
    })) as { _id: string };

    // Persist the task/index IDs so we can poll later
    await ctx.runMutation(api.analyses.updateAnalysis, {
      analysisId: args.analysisId,
      twelveLabsIndexId: args.indexId,
    });

    await ctx.runMutation(api.sessions.updateSessionStatus, {
      sessionId: args.sessionId,
      status: "processing",
    });

    return task._id;
  },
});

/**
 * Poll the status of a TwelveLabs indexing task.
 * Status values: "pending" | "indexing" | "ready" | "failed"
 */
export const getTaskStatus = action({
  args: {
    taskId: v.string(),
    analysisId: v.id("analyses"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{ status: string; videoId: string | null }> => {
    const task = (await tlFetch(`/tasks/${args.taskId}`)) as {
      status: string;
      video_id?: string;
    };

    if (task.status === "ready" && task.video_id) {
      // Persist the video ID now that indexing is complete
      await ctx.runMutation(api.analyses.updateAnalysis, {
        analysisId: args.analysisId,
        twelveLabsVideoId: task.video_id,
      });
      await ctx.runMutation(api.sessions.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "complete",
      });
    }

    if (task.status === "failed") {
      await ctx.runMutation(api.sessions.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "error",
        errorMessage: "TwelveLabs indexing failed",
      });
    }

    return {
      status: task.status,
      videoId: task.video_id ?? null,
    };
  },
});

/**
 * Run a Pegasus prompt against an indexed video to generate coaching analysis.
 * Stores the raw result in the analyses table.
 */
export const analyzeVideo = action({
  args: {
    analysisId: v.id("analyses"),
    videoId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const result = (await tlFetch("/generate/text", {
      method: "POST",
      body: JSON.stringify({
        video_id: args.videoId,
        prompt: args.prompt,
      }),
    })) as { data: string };

    await ctx.runMutation(api.analyses.updateAnalysis, {
      analysisId: args.analysisId,
      twelveLabsResult: result.data,
    });

    return result.data;
  },
});
