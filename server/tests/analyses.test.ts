import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { analyses } from "../src/routes/analyses.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return analyses.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createAnalysis", () => {
  test("happy path — creates analysis and returns id", async () => {
    queueRows([{ "1": 1 }]); // session exists check
    queueRows([{ id: "analysis-1" }]); // INSERT RETURNING id

    const res = await post("/createAnalysis", { sessionId: "sess-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("analysis-1");
  });

  test("not-found — 404 when session does not exist", async () => {
    queueRows([]); // session not found

    const res = await post("/createAnalysis", { sessionId: "nonexistent" });

    expect(res.status).toBe(404);
  });

  test("validation failure — 400 on missing sessionId", async () => {
    const res = await post("/createAnalysis", {});

    expect(res.status).toBe(400);
  });
});

describe("getAnalysis", () => {
  test("not-found — 404 for unknown analysisId", async () => {
    queueRows([]);

    const res = await post("/getAnalysis", { analysisId: "nonexistent" });

    expect(res.status).toBe(404);
  });
});

describe("getLatestAnalysis", () => {
  test("returns null when session has no analyses", async () => {
    queueRows([]);

    const res = await post("/getLatestAnalysis", { sessionId: "sess-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
