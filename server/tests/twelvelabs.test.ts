import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ─── Module mocks ─────────────────────────────────────────────────────────────
// The service touches Postgres + R2; both are stubbed so we only exercise the
// HTTP interaction with TwelveLabs and the DB calls produced as side effects.

const sqlCalls: Array<{ strings: TemplateStringsArray; values: unknown[] }> = [];
let sqlResults: Array<unknown[]> = [];

vi.mock("../src/db/client.js", () => {
  // porsager/postgres exposes `sql` as a tagged template that returns a Promise
  // of rows. Our mock records the call and pops the next queued result set.
  function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    sqlCalls.push({ strings, values });
    const next = sqlResults.shift() ?? [];
    return Promise.resolve(next);
  }
  return { sql };
});

vi.mock("../src/storage/r2.js", () => ({
  presignRead: vi.fn(async (key: string) => `https://signed.example/${key}`),
  presignUpload: vi.fn(),
  deleteObject: vi.fn(),
  newStorageId: vi.fn(() => "videos/mock"),
}));

// Service imported _after_ the mocks so it picks up the stubs.
import * as svc from "../src/services/twelvelabs.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

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
  sqlCalls.length = 0;
  sqlResults = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TWELVELABS_API_KEY;
});

// ─── getOrCreateIndex ─────────────────────────────────────────────────────────

describe("getOrCreateIndex", () => {
  test("returns existing index ID if found", async () => {
    mockFetch([
      { ok: true, body: { data: [{ _id: "idx-123", index_name: "playlog-tennis" }] } },
    ]);
    const indexId = await svc.getOrCreateIndex("tennis");
    expect(indexId).toBe("idx-123");
  });

  test("creates new index if none found", async () => {
    mockFetch([
      { ok: true, body: { data: [] } },
      { ok: true, body: { _id: "idx-new" } },
    ]);
    const indexId = await svc.getOrCreateIndex("tennis");
    expect(indexId).toBe("idx-new");
  });

  test("throws ApiError on TwelveLabs failure", async () => {
    mockFetch([{ ok: false, body: { message: "unauthorized" } }]);
    await expect(svc.getOrCreateIndex("tennis")).rejects.toThrow("TwelveLabs API error");
  });

  test("throws when TWELVELABS_API_KEY not set", async () => {
    delete process.env.TWELVELABS_API_KEY;
    // env is read lazily inside getApiKey, so no module re-import needed.
    await expect(svc.getOrCreateIndex("tennis")).rejects.toThrow(
      "TWELVELABS_API_KEY is not set"
    );
  });
});

// ─── indexVideo ───────────────────────────────────────────────────────────────

describe("indexVideo", () => {
  test("happy path — fetches storage key, presigns, posts task, persists state", async () => {
    sqlResults = [
      [{ video_storage_id: "videos/abc.mp4" }], // SELECT video_storage_id
      [],                                         // UPDATE analyses
      [],                                         // UPDATE sessions
    ];
    mockFetch([{ ok: true, body: { _id: "task-abc" } }]);

    const taskId = await svc.indexVideo({
      sessionId: "s-1",
      analysisId: "a-1",
      indexId: "idx-123",
    });

    expect(taskId).toBe("task-abc");
    // 3 SQL calls: SELECT then 2 UPDATEs
    expect(sqlCalls).toHaveLength(3);
  });

  test("throws when session not found", async () => {
    sqlResults = [[]]; // SELECT returns no rows
    await expect(
      svc.indexVideo({ sessionId: "s-missing", analysisId: "a-1", indexId: "idx-123" })
    ).rejects.toThrow("Session s-missing not found");
  });

  test("propagates TwelveLabs failure", async () => {
    sqlResults = [[{ video_storage_id: "videos/abc.mp4" }]];
    mockFetch([{ ok: false, body: { message: "invalid index" } }]);
    await expect(
      svc.indexVideo({ sessionId: "s-1", analysisId: "a-1", indexId: "idx-123" })
    ).rejects.toThrow("TwelveLabs API error");
  });
});

// ─── getTaskStatus ────────────────────────────────────────────────────────────

describe("getTaskStatus", () => {
  test("returns pending status without persisting", async () => {
    mockFetch([{ ok: true, body: { status: "pending" } }]);
    const result = await svc.getTaskStatus({
      taskId: "task-abc",
      analysisId: "a-1",
      sessionId: "s-1",
    });
    expect(result).toEqual({ status: "pending", videoId: null });
    expect(sqlCalls).toHaveLength(0);
  });

  test("ready status persists video id and marks session complete", async () => {
    sqlResults = [[], []]; // UPDATE analyses, UPDATE sessions
    mockFetch([{ ok: true, body: { status: "ready", video_id: "vid-999" } }]);
    const result = await svc.getTaskStatus({
      taskId: "task-abc",
      analysisId: "a-1",
      sessionId: "s-1",
    });
    expect(result).toEqual({ status: "ready", videoId: "vid-999" });
    expect(sqlCalls).toHaveLength(2);
  });

  test("failed status flips session to error", async () => {
    sqlResults = [[]]; // UPDATE sessions
    mockFetch([{ ok: true, body: { status: "failed" } }]);
    const result = await svc.getTaskStatus({
      taskId: "task-abc",
      analysisId: "a-1",
      sessionId: "s-1",
    });
    expect(result.status).toBe("failed");
    expect(sqlCalls).toHaveLength(1);
  });

  test("throws on TwelveLabs error response", async () => {
    mockFetch([{ ok: false, body: { message: "task not found" } }]);
    await expect(
      svc.getTaskStatus({ taskId: "bad-task", analysisId: "a-1", sessionId: "s-1" })
    ).rejects.toThrow("TwelveLabs API error");
  });
});

// ─── analyzeVideo ─────────────────────────────────────────────────────────────

describe("analyzeVideo", () => {
  test("happy path — stores Pegasus result", async () => {
    sqlResults = [[]]; // UPDATE analyses
    mockFetch([
      { ok: true, body: { data: "Player shows strong eastern grip on the forehand." } },
    ]);
    const result = await svc.analyzeVideo({
      analysisId: "a-1",
      videoId: "vid-999",
      prompt: "Analyze the forehand technique.",
    });
    expect(result).toBe("Player shows strong eastern grip on the forehand.");
    expect(sqlCalls).toHaveLength(1);
  });

  test("throws when Pegasus API call fails", async () => {
    mockFetch([{ ok: false, body: { message: "video not indexed" } }]);
    await expect(
      svc.analyzeVideo({ analysisId: "a-1", videoId: "vid-999", prompt: "Analyze" })
    ).rejects.toThrow("TwelveLabs API error");
  });
});
