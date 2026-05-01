// Builds an "authoritative timeline" of moments in a video that we can hand to
// Claude as the ONLY allowed reference points. Two sources are merged:
//
//   1. MediaPipe key frames (frame-accurate phase transitions: backswing,
//      impact, follow-through, etc). These are the gold standard.
//   2. Timestamps Claude/TwelveLabs already mentioned in the Pegasus output
//      text — kept as fallback anchors so we don't strip moments Pegasus
//      identified that pose detection missed.
//
// Claude is instructed to only reference timestamps from this list, and any
// timestamp it emits is post-validated by snapTimestamp() — snapped to the
// nearest authoritative moment within tolerance, or stripped.

export interface TimelineMoment {
  /** seconds, integer-second precision */
  seconds: number;
  /** human label for the prompt, e.g. "0:03 backswing" */
  label: string;
  /** where this came from, for debugging/observability */
  source: "pose" | "pegasus";
}

const TIMESTAMP_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Parse all m:ss / h:mm:ss tokens out of a free-text blob and return them as
// numeric seconds. Used to extract whatever Pegasus already said.
export function extractTimestampsFromText(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(TIMESTAMP_RE)) {
    const hasHours = m[3] !== undefined;
    const hours = hasHours ? parseInt(m[1]!) : 0;
    const minutes = hasHours ? parseInt(m[2]!) : parseInt(m[1]!);
    const secs = hasHours ? parseInt(m[3]!) : parseInt(m[2]!);
    out.push(hours * 3600 + minutes * 60 + secs);
  }
  return out;
}

interface KeyFrameLite {
  timestampMs: number;
  phase: string;
}

interface PoseAnalysisLite {
  technique?: string;
  keyFrames?: KeyFrameLite[];
}

// Extract key-frame moments from the serialized poseAnalysis JSON. The shape
// is `AnalysisResult | AnalysisResult[]` because we score multiple techniques
// per session — each result has its own keyFrames.
export function momentsFromPoseAnalysis(serialized: string | null | undefined): TimelineMoment[] {
  if (!serialized) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return [];
  }
  const results: PoseAnalysisLite[] = Array.isArray(parsed)
    ? (parsed as PoseAnalysisLite[])
    : [parsed as PoseAnalysisLite];

  const out: TimelineMoment[] = [];
  for (const r of results) {
    const technique = r.technique ?? "";
    for (const kf of r.keyFrames ?? []) {
      const seconds = Math.round(kf.timestampMs / 1000);
      const phase = kf.phase.replace(/_/g, " ");
      const label = technique
        ? `${fmt(seconds)} ${technique} ${phase}`
        : `${fmt(seconds)} ${phase}`;
      out.push({ seconds, label, source: "pose" });
    }
  }
  return out;
}

export function momentsFromPegasusText(text: string | null | undefined): TimelineMoment[] {
  if (!text) return [];
  return extractTimestampsFromText(text).map((seconds) => ({
    seconds,
    label: `${fmt(seconds)} (mentioned in video analysis)`,
    source: "pegasus" as const,
  }));
}

// Merge sources, dedupe near-duplicate seconds (pose wins because it's
// frame-accurate), sort chronologically.
export function buildTimeline(
  poseAnalysis: string | null | undefined,
  pegasusText: string | null | undefined,
  dedupeWindowSec = 1
): TimelineMoment[] {
  const all = [
    ...momentsFromPoseAnalysis(poseAnalysis),
    ...momentsFromPegasusText(pegasusText),
  ].sort((a, b) => a.seconds - b.seconds);

  const out: TimelineMoment[] = [];
  for (const m of all) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(m.seconds - prev.seconds) <= dedupeWindowSec) {
      // Pose wins on tie — Pegasus moment within ±1s of a pose moment is
      // assumed redundant.
      if (prev.source === "pegasus" && m.source === "pose") {
        out[out.length - 1] = m;
      }
      continue;
    }
    out.push(m);
  }
  return out;
}

// Snap a Claude-emitted timestamp to the nearest authoritative moment within
// tolerance. Returns the snapped seconds, or null if nothing is close enough.
export function snapTimestamp(
  seconds: number,
  authoritative: number[],
  toleranceSec = 2
): number | null {
  if (authoritative.length === 0) return null;
  let best = -1;
  let bestDist = Infinity;
  for (const a of authoritative) {
    const d = Math.abs(a - seconds);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return bestDist <= toleranceSec ? best : null;
}

// Walk a string, find every m:ss token, snap it to the authoritative timeline,
// and rewrite. Tokens with no nearby anchor are left unchanged (stripping
// would mangle surrounding punctuation like " — — fix").
//
// Returns { text, stats } so the caller can log how aggressive the pass was.
export function snapTimestampsInText(
  text: string,
  authoritative: number[],
  toleranceSec = 2
): { text: string; snapped: number; unmatched: number } {
  let snapped = 0;
  let unmatched = 0;
  const rewritten = text.replace(TIMESTAMP_RE, (match, p1, p2, p3) => {
    const hasHours = p3 !== undefined;
    const hours = hasHours ? parseInt(p1) : 0;
    const minutes = hasHours ? parseInt(p2) : parseInt(p1);
    const secs = hasHours ? parseInt(p3) : parseInt(p2);
    const total = hours * 3600 + minutes * 60 + secs;

    const snappedSec = snapTimestamp(total, authoritative, toleranceSec);
    if (snappedSec === null) {
      unmatched += 1;
      return match;
    }
    if (snappedSec !== total) snapped += 1;
    return fmt(snappedSec);
  });
  return { text: rewritten, snapped, unmatched };
}

// Format the timeline as a numbered list for inclusion in the system prompt.
// Truncated to keep the prompt small.
export function formatTimelineForPrompt(timeline: TimelineMoment[], max = 20): string {
  if (timeline.length === 0) return "(no authoritative timeline available)";
  return timeline.slice(0, max).map((m, i) => `${i + 1}. ${m.label}`).join("\n");
}
