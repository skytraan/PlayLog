// Mirror of the old `convex/_generated/api`. Each entry is a typed endpoint
// descriptor — useQuery/useMutation/useAction infer args + result from these.

import {
  defQuery,
  defMutation,
  defAction,
  type AnalysisDoc,
  type BadgeDoc,
  type FeedbackDoc,
  type GoalDoc,
  type Id,
  type MessageDoc,
  type SessionDoc,
  type SessionStatus,
  type SessionWithFeedback,
  type UserDoc,
} from "./types";

export interface AuthResponse {
  token: string;
  user: UserDoc;
}

export const api = {
  auth: {
    login: defMutation<{ email: string }, AuthResponse>("auth", "login"),
    signup: defMutation<
      { name: string; email: string; sports: string[] },
      AuthResponse
    >("auth", "signup"),
    me: defQuery<Record<string, never>, UserDoc>("auth", "me"),
  },

  sessions: {
    createSession: defMutation<
      {
        sport: string;
        videoStorageId: Id<"_storage">;
        requestedSections: string[];
      },
      Id<"sessions">
    >("sessions", "createSession"),
    updateSessionStatus: defMutation<
      {
        sessionId: Id<"sessions">;
        status: SessionStatus;
        errorMessage?: string;
      },
      null
    >("sessions", "updateSessionStatus"),
    getSession: defQuery<{ sessionId: Id<"sessions"> }, SessionDoc>("sessions", "getSession"),
    listSessions: defQuery<Record<string, never>, SessionDoc[]>("sessions", "listSessions"),
    listSessionsWithFeedback: defQuery<
      Record<string, never>,
      SessionWithFeedback[]
    >("sessions", "listSessionsWithFeedback"),
    deleteSession: defMutation<{ sessionId: Id<"sessions"> }, null>(
      "sessions",
      "deleteSession"
    ),
  },

  analyses: {
    createAnalysis: defMutation<
      { sessionId: Id<"sessions"> },
      Id<"analyses">
    >("analyses", "createAnalysis"),
    updateAnalysis: defMutation<
      {
        analysisId: Id<"analyses">;
        twelveLabsIndexId?: string;
        twelveLabsVideoId?: string;
        twelveLabsResult?: string;
        poseAnalysis?: string;
        overallScore?: number;
        technique?: string;
      },
      null
    >("analyses", "updateAnalysis"),
    getAnalysis: defQuery<{ analysisId: Id<"analyses"> }, AnalysisDoc>("analyses", "getAnalysis"),
    getLatestAnalysis: defQuery<{ sessionId: Id<"sessions"> }, AnalysisDoc | null>(
      "analyses",
      "getLatestAnalysis"
    ),
  },

  messages: {
    saveMessage: defMutation<
      { sessionId: Id<"sessions">; role: "user" | "model"; content: string },
      Id<"messages">
    >("messages", "saveMessage"),
    getMessages: defQuery<{ sessionId: Id<"sessions"> }, MessageDoc[]>(
      "messages",
      "getMessages"
    ),
    getRecentMessages: defQuery<
      { sessionId: Id<"sessions">; limit: number },
      MessageDoc[]
    >("messages", "getRecentMessages"),
  },

  feedback: {
    saveFeedback: defMutation<
      {
        sessionId: Id<"sessions">;
        analysisId: Id<"analyses">;
        summary: string;
        strengths: string[];
        improvements: string[];
        drills: string[];
      },
      Id<"feedback">
    >("feedback", "saveFeedback"),
    getFeedback: defQuery<{ feedbackId: Id<"feedback"> }, FeedbackDoc>(
      "feedback",
      "getFeedback"
    ),
    getLatestFeedback: defQuery<{ sessionId: Id<"sessions"> }, FeedbackDoc | null>(
      "feedback",
      "getLatestFeedback"
    ),
  },

  goals: {
    getGoal: defQuery<Record<string, never>, GoalDoc | null>("goals", "getGoal"),
    setGoal: defMutation<
      { targetOvr: number; deadline: string },
      Id<"goals">
    >("goals", "setGoal"),
  },

  badges: {
    getUserBadges: defQuery<Record<string, never>, BadgeDoc[]>(
      "badges",
      "getUserBadges"
    ),
    checkAndAwardBadges: defMutation<Record<string, never>, string[]>(
      "badges",
      "checkAndAwardBadges"
    ),
  },

  storage: {
    generateUploadUrl: defMutation<
      { contentType?: string },
      { uploadUrl: string; storageId: Id<"_storage"> }
    >("storage", "generateUploadUrl"),
    getVideoUrl: defQuery<{ storageId: Id<"_storage"> }, string | null>(
      "storage",
      "getVideoUrl"
    ),
    getSessionVideoUrl: defQuery<{ sessionId: Id<"sessions"> }, string | null>(
      "storage",
      "getSessionVideoUrl"
    ),
    deleteVideo: defMutation<{ storageId: Id<"_storage"> }, null>(
      "storage",
      "deleteVideo"
    ),
  },

  twelvelabs: {
    analyzeDirect: defAction<
      {
        sessionId: Id<"sessions">;
        analysisId: Id<"analyses">;
        prompt: string;
      },
      string
    >("twelvelabs", "analyzeDirect"),
  },

  coach: {
    generateFeedback: defAction<
      { sessionId: Id<"sessions">; analysisId: Id<"analyses"> },
      Id<"feedback">
    >("coach", "generateFeedback"),
    askCoach: defAction<
      { sessionId: Id<"sessions">; userMessage: string },
      string
    >("coach", "askCoach"),
  },
};
