import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db/client.js";
import { ApiError, rpc } from "../lib/route.js";
import {
  deleteObject,
  newStorageId,
  presignRead,
  presignUpload,
} from "../storage/r2.js";

export const storage = new Hono();

// Mirrors convex storage.generateUploadUrl. The frontend POSTs the bytes
// directly to the returned URL (Cloudflare R2), then passes `storageId` into
// createSession the same way it did with Convex's `_storage` ID.
const UploadArgs = z.object({
  contentType: z.string().optional(),
});

storage.post(
  "/generateUploadUrl",
  rpc(UploadArgs, async ({ contentType }) => {
    const storageId = newStorageId();
    const uploadUrl = await presignUpload(storageId, contentType ?? "video/mp4");
    return { uploadUrl, storageId };
  })
);

const ByStorageIdArgs = z.object({ storageId: z.string() });

storage.post(
  "/getVideoUrl",
  rpc(ByStorageIdArgs, async ({ storageId }) => {
    return presignRead(storageId);
  })
);

const BySessionIdArgs = z.object({ sessionId: z.string() });

storage.post(
  "/getSessionVideoUrl",
  rpc(BySessionIdArgs, async ({ sessionId }) => {
    const rows = await sql`
      SELECT video_storage_id FROM sessions WHERE id = ${sessionId}
    `;
    if (rows.length === 0) {
      throw new ApiError(`Session ${sessionId} not found`, 404);
    }
    return presignRead(rows[0]!.video_storage_id as string);
  })
);

storage.post(
  "/deleteVideo",
  rpc(ByStorageIdArgs, async ({ storageId }) => {
    await deleteObject(storageId);
    return null;
  })
);
