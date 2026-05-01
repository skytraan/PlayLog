import { describe, expect, test } from "vitest";
import {
  buildTimeline,
  extractTimestampsFromText,
  formatTimelineForPrompt,
  momentsFromPoseAnalysis,
  snapTimestamp,
  snapTimestampsInText,
} from "../src/lib/timeline.js";

// Compact pose-analysis fixtures matching the AnalysisResult shape produced by
// the MediaPipe scorers — only the fields the timeline builder reads.
const FOREHAND = JSON.stringify({
  technique: "forehand",
  keyFrames: [
    { timestampMs: 1000, phase: "preparation" },
    { timestampMs: 3000, phase: "backswing" },
    { timestampMs: 5000, phase: "impact" },
    { timestampMs: 7000, phase: "follow_through" },
  ],
});

describe("extractTimestampsFromText", () => {
  test("parses m:ss tokens", () => {
    expect(extractTimestampsFromText("issue at 0:23 and 1:05")).toEqual([23, 65]);
  });

  test("parses h:mm:ss tokens", () => {
    expect(extractTimestampsFromText("highlight at 1:02:30")).toEqual([3750]);
  });

  test("ignores non-timestamp digits", () => {
    expect(extractTimestampsFromText("score is 80 out of 100")).toEqual([]);
  });
});

describe("momentsFromPoseAnalysis", () => {
  test("converts keyFrames to labeled moments", () => {
    const moments = momentsFromPoseAnalysis(FOREHAND);
    expect(moments).toHaveLength(4);
    expect(moments[0]).toEqual({ seconds: 1, label: "0:01 forehand preparation", source: "pose" });
    expect(moments[2]).toEqual({ seconds: 5, label: "0:05 forehand impact", source: "pose" });
  });

  test("returns empty for null/invalid input", () => {
    expect(momentsFromPoseAnalysis(null)).toEqual([]);
    expect(momentsFromPoseAnalysis("not json")).toEqual([]);
  });

  test("handles array of analyses (multi-technique sessions)", () => {
    const multi = JSON.stringify([
      JSON.parse(FOREHAND),
      { technique: "serve", keyFrames: [{ timestampMs: 12000, phase: "impact" }] },
    ]);
    const moments = momentsFromPoseAnalysis(multi);
    expect(moments.find((m) => m.label.includes("serve"))).toBeDefined();
  });
});

describe("buildTimeline", () => {
  test("merges pose + pegasus, dedupes near-duplicates with pose winning", () => {
    // Pegasus mentions 0:05 (matches pose impact) and 0:09 (no pose anchor)
    const pegasusText = "Player makes contact at 0:05 and finishes at 0:09";
    const timeline = buildTimeline(FOREHAND, pegasusText);

    // 0:05 should appear once and be the pose-labeled version, not pegasus
    const fiveSec = timeline.filter((m) => m.seconds === 5);
    expect(fiveSec).toHaveLength(1);
    expect(fiveSec[0]!.source).toBe("pose");

    // 0:09 has no pose anchor so it survives as pegasus
    expect(timeline.find((m) => m.seconds === 9)?.source).toBe("pegasus");
  });

  test("sorts chronologically", () => {
    const timeline = buildTimeline(FOREHAND, "");
    const seconds = timeline.map((m) => m.seconds);
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
  });
});

describe("snapTimestamp", () => {
  const anchors = [3, 5, 7, 12];

  test("snaps within tolerance to nearest", () => {
    expect(snapTimestamp(6, anchors, 2)).toBe(5);
    expect(snapTimestamp(6.5, anchors, 2)).toBe(7);
  });

  test("returns null when no anchor is within tolerance", () => {
    expect(snapTimestamp(20, anchors, 2)).toBeNull();
  });

  test("exact match returns the anchor itself", () => {
    expect(snapTimestamp(5, anchors, 2)).toBe(5);
  });

  test("empty anchor list returns null", () => {
    expect(snapTimestamp(5, [], 2)).toBeNull();
  });
});

describe("snapTimestampsInText", () => {
  const anchors = [3, 5, 7];

  test("rewrites in-tolerance timestamps to the snapped value", () => {
    const result = snapTimestampsInText("issue at 0:06 — slow", anchors, 2);
    expect(result.text).toBe("issue at 0:05 — slow");
    expect(result.snapped).toBe(1);
    expect(result.unmatched).toBe(0);
  });

  test("leaves out-of-tolerance timestamps unchanged and counts them", () => {
    const result = snapTimestampsInText("at 0:30 player jumps", anchors, 2);
    expect(result.text).toBe("at 0:30 player jumps");
    expect(result.unmatched).toBe(1);
  });

  test("handles multiple timestamps in one string", () => {
    const result = snapTimestampsInText("from 0:04 to 0:08", anchors, 2);
    expect(result.text).toBe("from 0:03 to 0:07");
    expect(result.snapped).toBe(2);
  });
});

describe("formatTimelineForPrompt", () => {
  test("formats numbered list", () => {
    const timeline = momentsFromPoseAnalysis(FOREHAND);
    const out = formatTimelineForPrompt(timeline);
    expect(out).toContain("1. 0:01 forehand preparation");
    expect(out).toContain("4. 0:07 forehand follow through");
  });

  test("returns placeholder for empty timeline", () => {
    expect(formatTimelineForPrompt([])).toContain("no authoritative timeline");
  });

  test("truncates to max", () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      seconds: i,
      label: `${i}`,
      source: "pose" as const,
    }));
    const out = formatTimelineForPrompt(big, 5);
    expect(out.split("\n")).toHaveLength(5);
  });
});
