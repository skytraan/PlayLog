import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { badges } from "../src/routes/badges.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return badges.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("getUserBadges", () => {
  test("happy path — returns empty array when user has no badges", async () => {
    queueRows([]);

    const res = await post("/getUserBadges", { userId: "user-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("validation failure — 400 on missing userId", async () => {
    const res = await post("/getUserBadges", {});

    expect(res.status).toBe(400);
  });
});

describe("checkAndAwardBadges", () => {
  test("happy path — no sessions yields empty badge set", async () => {
    queueRows([]); // sessions + analyses join
    queueRows([]); // existing badges

    const res = await post("/checkAndAwardBadges", { userId: "user-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("awards ace-machine badge for serve score >= 75", async () => {
    queueRows([
      { created_at: 1000, technique: "serve", overall_score: 80 },
    ]); // sessions + analyses join
    queueRows([]); // existing badges
    queueRows([]); // INSERT badge

    const res = await post("/checkAndAwardBadges", { userId: "user-1" });

    expect(res.status).toBe(200);
    const awarded = await res.json() as string[];
    expect(awarded).toContain("ace-machine");
  });

  test("skips awarding badge already earned", async () => {
    queueRows([
      { created_at: 1000, technique: "serve", overall_score: 80 },
    ]); // sessions + analyses join
    queueRows([{ badge_id: "ace-machine" }]); // already earned

    const res = await post("/checkAndAwardBadges", { userId: "user-1" });

    expect(res.status).toBe(200);
    const awarded = await res.json() as string[];
    expect(awarded).toContain("ace-machine"); // returned in earned set
  });
});
