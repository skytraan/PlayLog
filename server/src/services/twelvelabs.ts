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

// Single-call replacement for the old index → poll → analyze flow. POST
// /analyze accepts a `video.url` directly, so we hand TwelveLabs the R2 read
// URL and let it pull the bytes itself. Saves the 30–90s indexing wait,
// removes the polling loop, and collapses the failure surface to one HTTP call.
//
// On any TwelveLabs failure the session status is flipped to 'error' so the
// client can surface it rather than leaving the session stuck in 'processing'.
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

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TwelveLabs analysis failed";
    await sql`
      UPDATE sessions SET status = 'error', error_message = ${msg}
      WHERE id = ${args.sessionId}
    `;
    throw err;
  }
}
