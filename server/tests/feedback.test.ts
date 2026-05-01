import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { feedback } from "../src/routes/feedback.js";
import { authHeaders } from "./helpers/auth.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return feedback.request(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

const validSaveFeedbackArgs = {
  sessionId: "sess-1",
  analysisId: "analysis-1",
  summary: "Good form overall.",
  strengths: ["Strong serve"],
  improvements: ["Follow-through"],
  drills: ["Shadow swings"],
};

describe("saveFeedback", () => {
  test("happy path — inserts feedback and returns id", async () => {
    queueRows([{ "1": 1 }]); // session exists check
    queueRows([{ id: "fb-1" }]); // INSERT RETURNING id

    const res = await post("/saveFeedback", validSaveFeedbackArgs);

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("fb-1");
  });

  test("not-found — 404 when session does not exist", async () => {
    queueRows([]); // session not found

    const res = await post("/saveFeedback", validSaveFeedbackArgs);

    expect(res.status).toBe(404);
  });

  test("validation failure — 400 on missing required fields", async () => {
    const res = await post("/saveFeedback", { sessionId: "sess-1" });

    expect(res.status).toBe(400);
  });
});

describe("getFeedback", () => {
  test("not-found — 404 for unknown feedbackId", async () => {
    queueRows([]);

    const res = await post("/getFeedback", { feedbackId: "nonexistent" });

    expect(res.status).toBe(404);
  });
});

describe("getLatestFeedback", () => {
  test("returns null when session has no feedback", async () => {
    queueRows([]);

    const res = await post("/getLatestFeedback", { sessionId: "sess-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
