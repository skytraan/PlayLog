import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));
vi.mock("../src/storage/r2.js", () => ({ deleteObject: vi.fn() }));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import { sessions } from "../src/routes/sessions.js";
import { authHeaders } from "./helpers/auth.js";

beforeEach(() => {
  resetSqlMock();
  vi.clearAllMocks();
});

async function post(path: string, body: unknown) {
  return sessions.request(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

describe("createSession", () => {
  test("happy path — creates session and returns id", async () => {
    queueRows([{ "1": 1 }]); // user exists check
    queueRows([{ id: "sess-1" }]); // INSERT RETURNING id

    const res = await post("/createSession", {
      sport: "tennis",
      videoStorageId: "videos/test.mp4",
      requestedSections: ["serve"],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toBe("sess-1");
  });

  test("validation failure — 400 when sport is empty", async () => {
    queueRows([{ "1": 1 }]); // user exists check

    const res = await post("/createSession", {
      sport: "   ",
      videoStorageId: "videos/test.mp4",
      requestedSections: ["serve"],
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/sport/i);
  });

  test("validation failure — 400 when requestedSections is empty", async () => {
    queueRows([{ "1": 1 }]); // user exists check

    const res = await post("/createSession", {
      sport: "tennis",
      videoStorageId: "videos/test.mp4",
      requestedSections: [],
    });

    expect(res.status).toBe(400);
  });
});

describe("getSession", () => {
  test("not-found — 404 for unknown sessionId", async () => {
    queueRows([]);

    const res = await post("/getSession", { sessionId: "nonexistent" });

    expect(res.status).toBe(404);
  });
});

describe("deleteSession", () => {
  test("happy path — deletes session and calls R2 cleanup", async () => {
    const { deleteObject } = await import("../src/storage/r2.js");
    queueRows([{ video_storage_id: "videos/test.mp4" }]); // DELETE RETURNING

    const res = await post("/deleteSession", { sessionId: "sess-1" });

    expect(res.status).toBe(200);
    expect(deleteObject).toHaveBeenCalledWith("videos/test.mp4");
  });

  test("not-found — 404 when session does not exist", async () => {
    queueRows([]); // DELETE returns no rows

    const res = await post("/deleteSession", { sessionId: "nonexistent" });

    expect(res.status).toBe(404);
  });
});
