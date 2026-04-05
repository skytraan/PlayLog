import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadAndIndexVideo, pollUntilReady } from "../../frontend/src/lib/twelvelabs/videoIndexer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConvex({
  mutationResult = "https://upload.url",
  actionResults = [] as unknown[],
} = {}) {
  let call = 0;
  return {
    mutation: vi.fn(async () => mutationResult),
    action: vi.fn(async () => actionResults[call++] ?? actionResults[actionResults.length - 1]),
  };
}

function mockFetch(ok: boolean, statusText = "") {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, statusText })));
}

const SESSION_ID = "session-123" as never;
const ANALYSIS_ID = "analysis-456" as never;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── uploadAndIndexVideo ──────────────────────────────────────────────────────

describe("uploadAndIndexVideo", () => {
  const baseParams = {
    videoBlob: new Blob(["fake-video"], { type: "video/mp4" }),
    sessionId: SESSION_ID,
    analysisId: ANALYSIS_ID,
    sport: "tennis",
  };

  test("happy path — returns taskId, sessionId, analysisId", async () => {
    const convex = makeConvex({ actionResults: ["idx-abc", "task-xyz"] });
    mockFetch(true);

    const result = await uploadAndIndexVideo(convex as never, baseParams);

    expect(result).toEqual({
      taskId: "task-xyz",
      sessionId: SESSION_ID,
      analysisId: ANALYSIS_ID,
    });
  });

  test("calls getOrCreateIndex with correct sport", async () => {
    const convex = makeConvex({ actionResults: ["idx-abc", "task-xyz"] });
    mockFetch(true);

    await uploadAndIndexVideo(convex as never, baseParams);

    expect(convex.action).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { sport: "tennis" }
    );
  });

  test("passes indexId from getOrCreateIndex into indexVideo", async () => {
    const convex = makeConvex({ actionResults: ["idx-abc", "task-xyz"] });
    mockFetch(true);

    await uploadAndIndexVideo(convex as never, baseParams);

    expect(convex.action).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      { sessionId: SESSION_ID, analysisId: ANALYSIS_ID, indexId: "idx-abc" }
    );
  });

  test("throws when video upload to Convex storage fails", async () => {
    const convex = makeConvex({ actionResults: ["idx-abc", "task-xyz"] });
    mockFetch(false, "Bad Request");

    await expect(
      uploadAndIndexVideo(convex as never, baseParams)
    ).rejects.toThrow("Video upload failed: Bad Request");
  });

  test("throws when getOrCreateIndex action fails", async () => {
    const convex = makeConvex();
    mockFetch(true);
    convex.action.mockRejectedValueOnce(new Error("TwelveLabs API error 500"));

    await expect(
      uploadAndIndexVideo(convex as never, baseParams)
    ).rejects.toThrow("TwelveLabs API error 500");
  });

  test("throws when indexVideo action fails", async () => {
    const convex = makeConvex();
    mockFetch(true);
    convex.action
      .mockResolvedValueOnce("idx-abc")
      .mockRejectedValueOnce(new Error("TwelveLabs API error 500"));

    await expect(
      uploadAndIndexVideo(convex as never, baseParams)
    ).rejects.toThrow("TwelveLabs API error 500");
  });
});

// ─── pollUntilReady ───────────────────────────────────────────────────────────

describe("pollUntilReady", () => {
  const baseParams = {
    taskId: "task-xyz",
    sessionId: SESSION_ID,
    analysisId: ANALYSIS_ID,
    intervalMs: 100,
    timeoutMs: 1000,
  };

  test("happy path — resolves immediately when status is ready", async () => {
    const convex = makeConvex({
      actionResults: [{ status: "ready", videoId: "vid-999" }],
    });

    const result = await pollUntilReady(convex as never, baseParams);

    expect(result).toEqual({ status: "ready", videoId: "vid-999" });
    expect(convex.action).toHaveBeenCalledTimes(1);
  });

  test("resolves when status is failed", async () => {
    const convex = makeConvex({
      actionResults: [{ status: "failed", videoId: null }],
    });

    const result = await pollUntilReady(convex as never, baseParams);

    expect(result.status).toBe("failed");
  });

  test("polls multiple times before resolving ready", async () => {
    const convex = makeConvex({
      actionResults: [
        { status: "pending", videoId: null },
        { status: "indexing", videoId: null },
        { status: "ready", videoId: "vid-999" },
      ],
    });

    const promise = pollUntilReady(convex as never, baseParams);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(convex.action).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("ready");
    expect(result.videoId).toBe("vid-999");
  });

  test("passes correct args to getTaskStatus on every poll", async () => {
    const convex = makeConvex({
      actionResults: [
        { status: "pending", videoId: null },
        { status: "ready", videoId: "vid-999" },
      ],
    });

    const promise = pollUntilReady(convex as never, baseParams);
    await vi.runAllTimersAsync();
    await promise;

    expect(convex.action).toHaveBeenCalledWith(expect.anything(), {
      taskId: "task-xyz",
      sessionId: SESSION_ID,
      analysisId: ANALYSIS_ID,
    });
  });

  test("throws when timeout is exceeded before ready", async () => {
    const convex = makeConvex({
      actionResults: [{ status: "pending", videoId: null }],
    });

    const promise = pollUntilReady(convex as never, {
      ...baseParams,
      timeoutMs: 0,
    });

    await expect(promise).rejects.toThrow("TwelveLabs indexing timed out after 0ms");
  });

  test("throws when getTaskStatus action fails", async () => {
    const convex = makeConvex();
    convex.action.mockRejectedValueOnce(new Error("TwelveLabs API error 500"));

    await expect(
      pollUntilReady(convex as never, baseParams)
    ).rejects.toThrow("TwelveLabs API error 500");
  });
});
