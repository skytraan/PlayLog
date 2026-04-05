// ─── Index ────────────────────────────────────────────────────────────────────

export interface TwelveLabsIndex {
  _id: string;
  name: string;
  engines: TwelveLabsEngine[];
  created_at: string;
  updated_at: string;
}

export interface TwelveLabsEngine {
  name: string;
  options: string[];
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TwelveLabsTaskStatus = "pending" | "indexing" | "ready" | "failed";

export interface TwelveLabsTask {
  _id: string;
  index_id: string;
  status: TwelveLabsTaskStatus;
  video_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Video ────────────────────────────────────────────────────────────────────

export interface TwelveLabsVideo {
  _id: string;
  index_id: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  created_at: string;
}

// ─── Generate / Analyze ───────────────────────────────────────────────────────

export interface TwelveLabsGenerateResponse {
  data: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ─── Frontend-facing results ──────────────────────────────────────────────────

export interface VideoIndexResult {
  taskId: string;
  sessionId: string;
  analysisId: string;
}

export interface TaskPollResult {
  status: TwelveLabsTaskStatus;
  videoId: string | null;
}
