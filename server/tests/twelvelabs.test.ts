import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"));

vi.mock("../src/storage/r2.js", () => ({
  presignRead: vi.fn(async (key: string) => `https://signed.example/${key}`),
  presignUpload: vi.fn(),
  deleteObject: vi.fn(),
  newStorageId: vi.fn(() => "videos/mock"),
}));

import { queueRows, resetSqlMock } from "./helpers/sql-mock.js";
import * as svc from "../src/services/twelvelabs.js";

function mockFetch(responses: Array<{ ok: boolean; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const resp = responses[call++] ?? responses[responses.length - 1]!;
      return {
        ok: resp.ok,
        status: resp.ok ? 200 : 500,
        json: async () => resp.body,
        text: async () => JSON.stringify(resp.body),
      } as Response;
    })
  );
}

beforeEach(() => {
  process.env.TWELVELABS_API_KEY = "test-api-key";
  resetSqlMock();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TWELVELABS_API_KEY;
});

// ─── analyzeDirect ────────────────────────────────────────────────────────────

describe("analyzeDirect", () => {
  test("happy path — presigns URL, calls /analyze, updates DB, returns result", async () => {
    queueRows([{ video_storage_id: "videos/abc.mp4" }]); // SELECT session
    queueRows([]); // UPDATE sessions status='processing'
    queueRows([]); // UPDATE analyses twelve_labs_result
    queueRows([]); // UPDATE sessions status='complete'

    mockFetch([{ ok: true, body: { data: "Strong forehand technique observed." } }]);

    const result = await svc.analyzeDirect({
      sessionId: "s-1",
      analysisId: "a-1",
      prompt: "Analyze the forehand.",
    });

    expect(result).toBe("Strong forehand technique observed.");
  });

  test("session not found — throws 404 ApiError without calling TwelveLabs", async () => {
    queueRows([]); // SELECT returns no rows

    await expect(
      svc.analyzeDirect({ sessionId: "s-missing", analysisId: "a-1", prompt: "Analyze." })
    ).rejects.toThrow("Session s-missing not found");
  });

  test("error recovery — sets session status to error when TwelveLabs call fails", async () => {
    queueRows([{ video_storage_id: "videos/abc.mp4" }]); // SELECT session
    queueRows([]); // UPDATE sessions status='processing'
    queueRows([]); // UPDATE sessions status='error' (in catch)

    mockFetch([{ ok: false, body: { message: "upstream error" } }]);

    await expect(
      svc.analyzeDirect({ sessionId: "s-1", analysisId: "a-1", prompt: "Analyze." })
    ).rejects.toThrow("TwelveLabs API error");
  });
});
