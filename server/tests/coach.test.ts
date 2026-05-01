import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock, sqlCalls } from "./helpers/sql-mock.js";
import { coach } from "../src/routes/coach.js";
import { authHeaders } from "./helpers/auth.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return coach.request(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

describe("generateFeedback — idempotency (issue #34)", () => {
  test("returns existing feedback id without calling Anthropic when feedback already exists for the analysis", async () => {
    queueRows([{ id: "fb-existing" }]); // SELECT id FROM feedback WHERE analysis_id

    const res = await post("/generateFeedback", {
      sessionId: "sess-1",
      analysisId: "ana-1",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("fb-existing");

    // Only the short-circuit lookup ran — no session/analysis fetch, no INSERT.
    const calls = sqlCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.strings.join("")).toMatch(/feedback.*analysis_id/s);
  });

  test("validation failure — 400 on missing analysisId", async () => {
    const res = await post("/generateFeedback", { sessionId: "sess-1" });
    expect(res.status).toBe(400);
  });
});
