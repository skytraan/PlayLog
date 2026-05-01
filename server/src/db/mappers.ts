// snake_case → Convex-flavored camelCase row mappers. Keeps the wire shape
// identical to what convex/_generated/dataModel exposed.

import type {
  AnalysisRow,
  BadgeRow,
  FeedbackRow,
  GoalRow,
  MessageRow,
  SessionRow,
  UserRow,
  SessionStatus,
  MessageRole,
} from "./types.js";

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v);

export function mapUser(r: Row): UserRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    name: r.name as string,
    email: r.email as string,
    sports: r.sports as string[],
    createdAt: num(r.created_at),
  };
}

export function mapSession(r: Row): SessionRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    userId: r.user_id as string,
    sport: r.sport as string,
    videoStorageId: r.video_storage_id as string,
    requestedSections: r.requested_sections as string[],
    status: r.status as SessionStatus,
    errorMessage: (r.error_message as string | null) ?? null,
    createdAt: num(r.created_at),
  };
}

export function mapAnalysis(r: Row): AnalysisRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    sessionId: r.session_id as string,
    twelveLabsIndexId: (r.twelve_labs_index_id as string | null) ?? null,
    twelveLabsVideoId: (r.twelve_labs_video_id as string | null) ?? null,
    twelveLabsResult: (r.twelve_labs_result as string | null) ?? null,
    poseAnalysis: (r.pose_analysis as string | null) ?? null,
    overallScore:
      r.overall_score === null || r.overall_score === undefined
        ? null
        : num(r.overall_score),
    technique: (r.technique as string | null) ?? null,
    createdAt: num(r.created_at),
  };
}

export function mapMessage(r: Row): MessageRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    sessionId: r.session_id as string,
    role: r.role as MessageRole,
    content: r.content as string,
    createdAt: num(r.created_at),
  };
}

export function mapGoal(r: Row): GoalRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    userId: r.user_id as string,
    targetOvr: num(r.target_ovr),
    deadline: r.deadline as string,
    createdAt: num(r.created_at),
    updatedAt: num(r.updated_at),
  };
}

export function mapBadge(r: Row): BadgeRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.earned_at),
    userId: r.user_id as string,
    badgeId: r.badge_id as string,
    earnedAt: num(r.earned_at),
  };
}

export function mapFeedback(r: Row): FeedbackRow {
  return {
    _id: r.id as string,
    _creationTime: num(r.created_at),
    sessionId: r.session_id as string,
    analysisId: r.analysis_id as string,
    summary: r.summary as string,
    strengths: r.strengths as string[],
    improvements: r.improvements as string[],
    drills: r.drills as string[],
    createdAt: num(r.created_at),
  };
}
