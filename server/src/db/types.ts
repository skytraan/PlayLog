// Database row shapes. Mirrors convex/schema.ts exactly so the frontend can
// keep using the same field names.
//
// _id and _creationTime are kept on the wire for parity with Convex's
// generated dataModel, even though Postgres uses `id` + `createdAt` natively.

export type SessionStatus = "uploading" | "processing" | "complete" | "error";
export type MessageRole = "user" | "model";

export interface UserRow {
  _id: string;
  _creationTime: number;
  name: string;
  email: string;
  sports: string[];
  createdAt: number;
}

export interface SessionRow {
  _id: string;
  _creationTime: number;
  userId: string;
  sport: string;
  videoStorageId: string;
  requestedSections: string[];
  status: SessionStatus;
  errorMessage: string | null;
  createdAt: number;
}

export interface AnalysisRow {
  _id: string;
  _creationTime: number;
  sessionId: string;
  twelveLabsIndexId: string | null;
  twelveLabsVideoId: string | null;
  twelveLabsResult: string | null;
  poseAnalysis: string | null;
  overallScore: number | null;
  technique: string | null;
  createdAt: number;
}

export interface MessageRow {
  _id: string;
  _creationTime: number;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface GoalRow {
  _id: string;
  _creationTime: number;
  userId: string;
  targetOvr: number;
  deadline: string;
  createdAt: number;
  updatedAt: number;
}

export interface BadgeRow {
  _id: string;
  _creationTime: number;
  userId: string;
  badgeId: string;
  earnedAt: number;
}

export interface FeedbackRow {
  _id: string;
  _creationTime: number;
  sessionId: string;
  analysisId: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  drills: string[];
  createdAt: number;
}
