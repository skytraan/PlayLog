import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { messages } from "../src/routes/messages.js";
import { authHeaders } from "./helpers/auth.js";

beforeEach(() => resetSqlMock());

async function post(path: string, body: unknown) {
  return messages.request(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

describe("saveMessage", () => {
  test("happy path — inserts message and returns id", async () => {
    queueRows([{ id: "msg-1" }]); // INSERT RETURNING id

    const res = await post("/saveMessage", {
      sessionId: "sess-1",
      role: "user",
      content: "How's my serve?",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("msg-1");
  });

  test("validation failure — 400 on invalid role enum", async () => {
    const res = await post("/saveMessage", {
      sessionId: "sess-1",
      role: "assistant", // not a valid enum value
      content: "hello",
    });

    expect(res.status).toBe(400);
  });

  test("validation failure — 400 on missing required fields", async () => {
    const res = await post("/saveMessage", { sessionId: "sess-1" });

    expect(res.status).toBe(400);
  });
});

describe("getMessages", () => {
  test("returns empty array when session has no messages", async () => {
    queueRows([]);

    const res = await post("/getMessages", { sessionId: "sess-1" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("getRecentMessages", () => {
  test("validation failure — 400 on non-positive limit", async () => {
    const res = await post("/getRecentMessages", {
      sessionId: "sess-1",
      limit: -1,
    });

    expect(res.status).toBe(400);
  });
});
