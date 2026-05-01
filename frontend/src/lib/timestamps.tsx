import type React from "react";

// Parse "m:ss" or "h:mm:ss" timestamps from a string. Used by the session
// detail and chat panes so coach-generated timestamps render as inline
// seek-buttons that jump the active video.
export function extractTimestamps(text: string): Array<{ label: string; seconds: number }> {
  const matches = [...text.matchAll(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g)];
  return matches.map((m) => {
    const hasHours = m[3] !== undefined;
    const hours   = hasHours ? parseInt(m[1]!) : 0;
    const minutes = hasHours ? parseInt(m[2]!) : parseInt(m[1]!);
    const secs    = hasHours ? parseInt(m[3]!) : parseInt(m[2]!);
    return { label: m[0], seconds: hours * 3600 + minutes * 60 + secs };
  });
}

interface FeedbackTextProps {
  text: string;
  onSeek?: (seconds: number) => void;
}

// Render a string with inline timestamp chips that call onSeek. If no onSeek
// is provided (or no timestamps are present) it degrades to a plain span.
export function FeedbackText({ text, onSeek }: FeedbackTextProps) {
  if (!onSeek) return <span>{text}</span>;

  const timestamps = extractTimestamps(text);
  if (timestamps.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const ts of timestamps) {
    const idx = text.indexOf(ts.label, cursor);
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <button
        key={idx}
        type="button"
        onClick={() => onSeek(ts.seconds)}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary hover:bg-primary/20 transition-colors mx-0.5"
      >
        {ts.label}
      </button>
    );
    cursor = idx + ts.label.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <span>{parts}</span>;
}
