import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadAndIndexVideo, pollUntilReady } from "../videoIndexer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SESSION_ID = "session-123" as never;
const ANALYSIS_ID = "analysis-456" as never;

/**
 * Builds a fetch mock that returns a queued sequence of JSON responses. Every
 * call to the API client funnels through global fetch — by stubbing it we can
 * assert on the requests made (URL + body) and control the responses.
 */
function mockApiResponses(payloads: unknown[]) {
  let call = 0;
  const fn = vi.fn(async () => {
    const payload = payloads[call] ?? payloads[payloads.length - 1];
    call += 1;
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

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
    sessionId: SESSION_ID,
    analysisId: ANALYSIS_ID,
    sport: "tennis",
  };

  test("happy path — returns taskId + ids and calls both endpoints", async () => {
    const fetchFn = mockApiResponses(["idx-abc", "task-xyz"]);

    const result = await uploadAndIndexVideo(baseParams);

    expect(result).toEqual({
      taskId: "task-xyz",
      sessionId: SESSION_ID,
      analysisId: ANALYSIS_ID,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect((fetchFn.mock.calls[0]![0] as string)).toMatch(
      /\/api\/twelvelabs\/getOrCreateIndex$/
    );
    expect((fetchFn.mock.calls[1]![0] as string)).toMatch(
      /\/api\/twelvelabs\/indexVideo$/
    );
  });

  test("forwards sport into getOrCreateIndex body", async () => {
    const fetchFn = mockApiResponses(["idx-abc", "task-xyz"]);

    await uploadAndIndexVideo(baseParams);

    const body = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ sport: "tennis" });
  });

  test("passes indexId from getOrCreateIndex into indexVideo", async () => {
    const fetchFn = mockApiResponses(["idx-abc", "task-xyz"]);

    await uploadAndIndexVideo(baseParams);

    const body = JSON.parse((fetchFn.mock.calls[1]![1] as RequestInit).body as string);
    expect(body).toEqual({
      sessionId: SESSION_ID,
      analysisId: ANALYSIS_ID,
      indexId: "idx-abc",
    });
  });

  test("throws when getOrCreateIndex returns an error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "TwelveLabs API error 500" }),
        text: async () => '{"error":"TwelveLabs API error 500"}',
      }))
    );

    await expect(uploadAndIndexVideo(baseParams)).rejects.toThrow(
      "TwelveLabs API error 500"
    );
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
    const fetchFn = mockApiResponses([{ status: "ready", videoId: "vid-999" }]);

    const result = await pollUntilReady(baseParams);

    expect(result).toEqual({ status: "ready", videoId: "vid-999" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("resolves when status is failed", async () => {
    mockApiResponses([{ status: "failed", videoId: null }]);

    const result = await pollUntilReady(baseParams);

    expect(result.status).toBe("failed");
  });

  test("polls multiple times before resolving ready", async () => {
    const fetchFn = mockApiResponses([
      { status: "pending", videoId: null },
      { status: "indexing", videoId: null },
      { status: "ready", videoId: "vid-999" },
    ]);

    const promise = pollUntilReady(baseParams);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ status: "ready", videoId: "vid-999" });
  });

  test("throws when timeout is exceeded", async () => {
    mockApiResponses([{ status: "pending", videoId: null }]);

    const promise = pollUntilReady({ ...baseParams, timeoutMs: 0 });

    await expect(promise).rejects.toThrow(
      "TwelveLabs indexing timed out after 0ms"
    );
  });
});
