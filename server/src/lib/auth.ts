// HS256 JWT helpers backed by Node's built-in crypto (no external deps).
//
// Token shape: { sub: <userId>, iat, exp } — 30-day default expiry.
// Verification failures throw an ApiError(401), so route handlers don't have
// to translate the "bad/missing/expired token" branches themselves.

import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.js";
import { env } from "./env.js";

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 30;

function b64uEncode(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uEncodeStr(s: string): string {
  return b64uEncode(Buffer.from(s, "utf8"));
}

function b64uDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((s.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function hmac(input: string): Buffer {
  return createHmac("sha256", env.jwtSecret).update(input).digest();
}

export function signToken(userId: string, ttlSec = DEFAULT_TTL_SEC): string {
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = b64uEncodeStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = b64uEncodeStr(JSON.stringify({ sub: userId, iat: now, exp: now + ttlSec }));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = b64uEncode(hmac(signingInput));
  return `${signingInput}.${sig}`;
}

export function verifyToken(token: string): { userId: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError("invalid token", 401);
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const expected = hmac(`${headerB64}.${payloadB64}`);
  const provided = b64uDecode(sigB64);
  // timingSafeEqual requires equal-length inputs; otherwise it throws.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new ApiError("invalid token", 401);
  }

  let payload: { sub?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(b64uDecode(payloadB64).toString("utf8")) as typeof payload;
  } catch {
    throw new ApiError("invalid token", 401);
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new ApiError("invalid token", 401);
  }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError("token expired", 401);
  }

  return { userId: payload.sub };
}

// Pulls a Bearer token out of the Authorization header. Returns null when the
// header is missing or malformed — verification errors surface from
// verifyToken, not from this helper.
export function bearerToken(authHeader: string | undefined | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  return m ? m[1]!.trim() : null;
}
