// Direct port of convex/twelvelabs.ts. Same control flow — only the persistence
// calls now hit Postgres + R2 instead of Convex's ctx.db / ctx.storage.

import { sql } from "../db/client.js";
import { ApiError } from "../lib/errors.js";
import { env } from "../lib/env.js";
import { presignRead } from "../storage/r2.js";

const BASE_URL = "https://api.twelvelabs.io/v1.3";

function getApiKey(): string {
  const key = env.twelvelabsApiKey;
  if (!key) throw new ApiError("TWELVELABS_API_KEY is not set", 500);
  return key;
}

async function tlFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "x-api-key": getApiKey(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(`TwelveLabs API error ${res.status}: ${body}`, 502);
  }

  return res.json();
}

// --- Action equivalents ----------------------------------------------------

export async function getOrCreateIndex(sport: string): Promise<string> {
  const indexName = `playlog-${sport.toLowerCase()}`;
  const list = (await tlFetch(
    `/indexes?index_name=${encodeURIComponent(indexName)}`
  )) as { data: { _id: string; index_name: string }[] };

  const existing = list.data.find((i) => i.index_name === indexName);
  if (existing) return existing._id;

  const created = (await tlFetch("/indexes", {
    method: "POST",
    body: JSON.stringify({
      index_name: indexName,
      // v1.3 renamed the field from `options` to `model_options`. Sending
      // the wrong key makes TwelveLabs see zero options and reject the index.
      models: [{ model_name: "pegasus1.2", model_options: ["visual", "audio"] }],
    }),
  })) as { _id: string };

  return created._id;
}

export async function indexVideo(args: {
  sessionId: string;
  analysisId: string;
  indexId: string;
}): Promise<string> {
  // Pull the video storage key for this session, presign a read URL, hand it
  // off to TwelveLabs the same way convex did with ctx.storage.getUrl.
  const sessRows = await sql`
    SELECT video_storage_id FROM sessions WHERE id = ${args.sessionId}
  `;
  if (sessRows.length === 0) {
    throw new ApiError(`Session ${args.sessionId} not found`, 404);
  }
  const videoUrl = await presignRead(sessRows[0]!.video_storage_id as string);
  if (!videoUrl) throw new ApiError("Could not retrieve video URL from storage", 500);

  const form = new FormData();
  form.append("index_id", args.indexId);
  form.append("video_url", videoUrl);

  const task = (await tlFetch("/tasks", {
    method: "POST",
    body: form,
  })) as { _id: string };

  await sql`
    UPDATE analyses SET twelve_labs_index_id = ${args.indexId}
    WHERE id = ${args.analysisId}
  `;
  await sql`
    UPDATE sessions SET status = 'processing'
    WHERE id = ${args.sessionId}
  `;

  return task._id;
}

export async function getTaskStatus(args: {
  taskId: string;
  analysisId: string;
  sessionId: string;
}): Promise<{ status: string; videoId: string | null }> {
  const task = (await tlFetch(`/tasks/${args.taskId}`)) as {
    status: string;
    video_id?: string;
  };

  if (task.status === "ready" && task.video_id) {
    await sql`
      UPDATE analyses SET twelve_labs_video_id = ${task.video_id}
      WHERE id = ${args.analysisId}
    `;
    await sql`
      UPDATE sessions SET status = 'complete'
      WHERE id = ${args.sessionId}
    `;
  }

  if (task.status === "failed") {
    await sql`
      UPDATE sessions SET status = 'error', error_message = 'TwelveLabs indexing failed'
      WHERE id = ${args.sessionId}
    `;
  }

  return { status: task.status, videoId: task.video_id ?? null };
}

export async function analyzeVideo(args: {
  analysisId: string;
  videoId: string;
  prompt: string;
}): Promise<string> {
  const result = (await tlFetch("/analyze", {
    method: "POST",
    body: JSON.stringify({
      video_id: args.videoId,
      prompt: args.prompt,
      stream: false,
    }),
  })) as { data: string };

  await sql`
    UPDATE analyses SET twelve_labs_result = ${result.data}
    WHERE id = ${args.analysisId}
  `;

  return result.data;
}

// Single-call replacement for index → poll → analyze. POST /analyze accepts a
// `video.url` directly, so we hand TwelveLabs the R2 read URL and let it pull
// the bytes itself. Saves the 30–90s indexing wait, removes the polling loop,
// and collapses the failure surface to one HTTP call.
//
// Caveat: TwelveLabs requires a "publicly accessible" URL. Presigned R2 URLs
// usually pass; if they don't, set R2_PUBLIC_BASE_URL and presignRead returns
// the public-CDN form instead.
export async function analyzeDirect(args: {
  sessionId: string;
  analysisId: string;
  prompt: string;
}): Promise<string> {
  const sessRows = await sql`
    SELECT video_storage_id FROM sessions WHERE id = ${args.sessionId}
  `;
  if (sessRows.length === 0) {
    throw new ApiError(`Session ${args.sessionId} not found`, 404);
  }
  const videoUrl = await presignRead(sessRows[0]!.video_storage_id as string);
  if (!videoUrl) throw new ApiError("Could not retrieve video URL from storage", 500);

  await sql`
    UPDATE sessions SET status = 'processing' WHERE id = ${args.sessionId}
  `;

  const result = (await tlFetch("/analyze", {
    method: "POST",
    body: JSON.stringify({
      video: { type: "url", url: videoUrl },
      prompt: args.prompt,
      stream: false,
    }),
  })) as { data: string };

  await sql`
    UPDATE analyses SET twelve_labs_result = ${result.data}
    WHERE id = ${args.analysisId}
  `;
  await sql`
    UPDATE sessions SET status = 'complete' WHERE id = ${args.sessionId}
  `;

  return result.data;
}
