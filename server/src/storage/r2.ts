import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env.js";

// Cloudflare R2 is S3-API compatible. Region must be "auto".
const s3 = new S3Client({
  region: "auto",
  endpoint: env.r2.endpoint,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});

const PUT_TTL_SECONDS = 60 * 15;   // 15 min — uploader has time to finish
const GET_TTL_SECONDS = 60 * 60;   // 1 hour — TwelveLabs / video player

// "storageId" is the R2 object key. We expose it to the frontend as an opaque
// string so the rest of the API (sessions.videoStorageId) stays Convex-shaped.
export function newStorageId(): string {
  return `videos/${randomUUID()}`;
}

export async function presignUpload(
  storageId: string,
  contentType: string
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.r2.bucket,
    Key: storageId,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: PUT_TTL_SECONDS });
}

export async function presignRead(storageId: string): Promise<string> {
  // If a public CDN base is configured, prefer that — saves a presign round-trip
  // and avoids the URL-rotation problem when caching in the frontend.
  if (env.r2.publicBaseUrl) {
    return `${env.r2.publicBaseUrl.replace(/\/$/, "")}/${storageId}`;
  }
  const cmd = new GetObjectCommand({
    Bucket: env.r2.bucket,
    Key: storageId,
  });
  return getSignedUrl(s3, cmd, { expiresIn: GET_TTL_SECONDS });
}

export async function deleteObject(storageId: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.r2.bucket,
      Key: storageId,
    })
  );
}

// Paginated list of every object key under `prefix`. The cleanup job uses this
// to diff R2 against the sessions table; nothing in the request path should
// call this (a full-bucket list is slow and not free).
export async function listAllObjects(prefix = "videos/"): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.r2.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}
