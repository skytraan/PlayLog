import { convexTest } from "convex-test";
import { expect, test, describe, vi, afterEach, beforeEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

// ─── fetch mock setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.TWELVELABS_API_KEY = "test-api-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TWELVELABS_API_KEY;
});

function mockFetch(responses: Array<{ ok: boolean; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const resp = responses[call++] ?? responses[responses.length - 1];
      return {
        ok: resp.ok,
        status: resp.ok ? 200 : 500,
        json: async () => resp.body,
        text: async () => JSON.stringify(resp.body),
      };
    })
  );
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedSession(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
      sports: ["tennis"],
      createdAt: Date.now(),
    });
    const storageId = await ctx.storage.store(
      new Blob(["fake-video"], { type: "video/mp4" })
    );
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      sport: "tennis",
      videoStorageId: storageId,
      requestedSections: ["forehand", "serve"],
      status: "uploading" as const,
      createdAt: Date.now(),
    });
    const analysisId = await ctx.db.insert("analyses", {
      sessionId,
      createdAt: Date.now(),
    });
    return { sessionId, analysisId, storageId };
  });
}

// ─── getOrCreateIndex ─────────────────────────────────────────────────────────

describe("getOrCreateIndex", () => {
  test("happy path — returns existing index ID if found", async () => {
    const t = convexTest(schema);
    mockFetch([
      { ok: true, body: { data: [{ _id: "idx-123", name: "playlog-tennis" }] } },
    ]);

    const indexId = await t.action(api.twelvelabs.getOrCreateIndex, {
      sport: "tennis",
    });

    expect(indexId).toBe("idx-123");
  });

  test("happy path — creates new index if none found", async () => {
    const t = convexTest(schema);
    mockFetch([
      { ok: true, body: { data: [] } },
      { ok: true, body: { _id: "idx-new" } },
    ]);

    const indexId = await t.action(api.twelvelabs.getOrCreateIndex, {
      sport: "tennis",
    });

    expect(indexId).toBe("idx-new");
  });

  test("throws ConvexError when API returns error", async () => {
    const t = convexTest(schema);
    mockFetch([{ ok: false, body: { message: "unauthorized" } }]);

    await expect(
      t.action(api.twelvelabs.getOrCreateIndex, { sport: "tennis" })
    ).rejects.toThrow("TwelveLabs API error");
  });

  test("throws when TWELVELABS_API_KEY is not set", async () => {
    delete process.env.TWELVELABS_API_KEY;
    const t = convexTest(schema);

    await expect(
      t.action(api.twelvelabs.getOrCreateIndex, { sport: "tennis" })
    ).rejects.toThrow("TWELVELABS_API_KEY is not set");
  });
});

// ─── indexVideo ───────────────────────────────────────────────────────────────

describe("indexVideo", () => {
  test("happy path — submits video and returns task ID", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: true, body: { _id: "task-abc" } }]);

    const taskId = await t.action(api.twelvelabs.indexVideo, {
      sessionId,
      analysisId,
      indexId: "idx-123",
    });

    expect(taskId).toBe("task-abc");

    // Session should be set to processing
    const session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("processing");
  });

  test("throws when TwelveLabs task creation fails", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: false, body: { message: "invalid index" } }]);

    await expect(
      t.action(api.twelvelabs.indexVideo, {
        sessionId,
        analysisId,
        indexId: "idx-123",
      })
    ).rejects.toThrow("TwelveLabs API error");
  });
});

// ─── getTaskStatus ────────────────────────────────────────────────────────────

describe("getTaskStatus", () => {
  test("happy path — returns pending status", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: true, body: { status: "pending" } }]);

    const result = await t.action(api.twelvelabs.getTaskStatus, {
      taskId: "task-abc",
      analysisId,
      sessionId,
    });

    expect(result.status).toBe("pending");
    expect(result.videoId).toBeNull();
  });

  test("happy path — stores videoId and marks complete when ready", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: true, body: { status: "ready", video_id: "vid-999" } }]);

    const result = await t.action(api.twelvelabs.getTaskStatus, {
      taskId: "task-abc",
      analysisId,
      sessionId,
    });

    expect(result.status).toBe("ready");
    expect(result.videoId).toBe("vid-999");

    const analysis = await t.run((ctx) => ctx.db.get(analysisId));
    expect(analysis?.twelveLabsVideoId).toBe("vid-999");

    const session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("complete");
  });

  test("marks session as error when task fails", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: true, body: { status: "failed" } }]);

    const result = await t.action(api.twelvelabs.getTaskStatus, {
      taskId: "task-abc",
      analysisId,
      sessionId,
    });

    expect(result.status).toBe("failed");

    const session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.status).toBe("error");
    expect(session?.errorMessage).toBe("TwelveLabs indexing failed");
  });

  test("throws when TwelveLabs API returns error", async () => {
    const t = convexTest(schema);
    const { sessionId, analysisId } = await seedSession(t);

    mockFetch([{ ok: false, body: { message: "task not found" } }]);

    await expect(
      t.action(api.twelvelabs.getTaskStatus, {
        taskId: "bad-task",
        analysisId,
        sessionId,
      })
    ).rejects.toThrow("TwelveLabs API error");
  });
});

// ─── analyzeVideo ─────────────────────────────────────────────────────────────

describe("analyzeVideo", () => {
  test("happy path — stores and returns Pegasus result", async () => {
    const t = convexTest(schema);
    const { analysisId } = await seedSession(t);

    mockFetch([
      {
        ok: true,
        body: { data: "Player shows strong eastern grip on the forehand." },
      },
    ]);

    const result = await t.action(api.twelvelabs.analyzeVideo, {
      analysisId,
      videoId: "vid-999",
      prompt: "Analyze the forehand technique.",
    });

    expect(result).toBe("Player shows strong eastern grip on the forehand.");

    const analysis = await t.run((ctx) => ctx.db.get(analysisId));
    expect(analysis?.twelveLabsResult).toBe(
      "Player shows strong eastern grip on the forehand."
    );
  });

  test("throws when Pegasus API call fails", async () => {
    const t = convexTest(schema);
    const { analysisId } = await seedSession(t);

    mockFetch([{ ok: false, body: { message: "video not indexed" } }]);

    await expect(
      t.action(api.twelvelabs.analyzeVideo, {
        analysisId,
        videoId: "vid-999",
        prompt: "Analyze the serve technique.",
      })
    ).rejects.toThrow("TwelveLabs API error");
  });
});
