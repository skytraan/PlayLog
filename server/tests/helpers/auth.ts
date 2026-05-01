// Test helper: sign a Bearer token for a fixed userId. Tests that hit a
// protected endpoint should pass `authHeaders(userId)` in their request init.

import { signToken } from "../../src/lib/auth.js";

export const TEST_USER_ID = "test-user-1";

export function authHeaders(userId: string = TEST_USER_ID): Record<string, string> {
  const token = signToken(userId);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
