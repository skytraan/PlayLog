import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { goals } from "../src/routes/goals.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return goals.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("getGoal", () => {
  test("returns null when user has no goal", async () => {
    queueRows([]);

    const res = await post("/getGoal", { userId: "user-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("setGoal", () => {
  test("happy path — inserts new goal and returns id", async () => {
    queueRows([]); // no existing goal
    queueRows([{ id: "goal-1" }]); // INSERT RETURNING id

    const res = await post("/setGoal", {
      userId: "user-1",
      targetOvr: 80,
      deadline: "2026-12-31",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("goal-1");
  });

  test("updates existing goal when user already has one", async () => {
    queueRows([{ id: "goal-existing" }]); // existing goal found
    queueRows([]); // UPDATE

    const res = await post("/setGoal", {
      userId: "user-1",
      targetOvr: 90,
      deadline: "2026-12-31",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("goal-existing");
  });

  test("validation failure — 400 when targetOvr is out of range", async () => {
    const res = await post("/setGoal", {
      userId: "user-1",
      targetOvr: 0,
      deadline: "2026-12-31",
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/targetOvr/i);
  });
});
