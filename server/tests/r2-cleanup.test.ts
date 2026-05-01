import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const sqlCalls: Array<{ strings: TemplateStringsArray; values: unknown[] }> = [];
let sqlResults: Array<unknown[]> = [];

vi.mock("../src/db/client.js", () => {
  function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    sqlCalls.push({ strings, values });
    const next = sqlResults.shift() ?? [];
    return Promise.resolve(next);
  }
  return { sql };
});

const listAllObjects = vi.fn();
const deleteObject = vi.fn();

vi.mock("../src/storage/r2.js", () => ({
  listAllObjects: (prefix?: string) => listAllObjects(prefix),
  deleteObject: (key: string) => deleteObject(key),
  presignRead: vi.fn(),
  presignUpload: vi.fn(),
  newStorageId: vi.fn(),
}));

import { runR2Cleanup } from "../src/jobs/r2-cleanup.js";

beforeEach(() => {
  sqlCalls.length = 0;
  sqlResults = [];
  listAllObjects.mockReset();
  deleteObject.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runR2Cleanup", () => {
  test("deletes objects that aren't referenced by any session", async () => {
    listAllObjects.mockResolvedValue([
      "videos/keep-1",
      "videos/orphan-1",
      "videos/keep-2",
      "videos/orphan-2",
    ]);
    sqlResults.push([
      { video_storage_id: "videos/keep-1" },
      { video_storage_id: "videos/keep-2" },
    ]);

    const report = await runR2Cleanup();

    expect(report.scannedObjects).toBe(4);
    expect(report.referencedKeys).toBe(2);
    expect(report.orphans).toBe(2);
    expect(report.deleted).toBe(2);
    expect(report.failures).toEqual([]);
    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenCalledWith("videos/orphan-1");
    expect(deleteObject).toHaveBeenCalledWith("videos/orphan-2");
  });

  test("dry-run reports orphans without deleting", async () => {
    listAllObjects.mockResolvedValue(["videos/a", "videos/b"]);
    sqlResults.push([{ video_storage_id: "videos/a" }]);

    const report = await runR2Cleanup({ dryRun: true });

    expect(report.orphans).toBe(1);
    expect(report.deleted).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  test("records per-object failures, keeps going", async () => {
    listAllObjects.mockResolvedValue(["videos/orphan-1", "videos/orphan-2"]);
    sqlResults.push([]);
    deleteObject
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(undefined);

    const report = await runR2Cleanup();

    expect(report.deleted).toBe(1);
    expect(report.failures).toEqual([
      { key: "videos/orphan-1", error: "network timeout" },
    ]);
  });

  test("noop when bucket is empty", async () => {
    listAllObjects.mockResolvedValue([]);
    sqlResults.push([]);

    const report = await runR2Cleanup();

    expect(report).toEqual({
      scannedObjects: 0,
      referencedKeys: 0,
      orphans: 0,
      deleted: 0,
      failures: [],
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  test("noop when every object is referenced", async () => {
    listAllObjects.mockResolvedValue(["videos/a", "videos/b"]);
    sqlResults.push([
      { video_storage_id: "videos/a" },
      { video_storage_id: "videos/b" },
    ]);

    const report = await runR2Cleanup();

    expect(report.orphans).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
