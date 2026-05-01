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

export const api = {
  users: {
    createUser: defMutation<
      { name: string; email: string; sports: string[] },
      Id<"users">
    >("users", "createUser"),
    getUser: defQuery<{ userId: Id<"users"> }, UserDoc>("users", "getUser"),
    findUser: defQuery<{ userId: Id<"users"> }, UserDoc | null>("users", "findUser"),
    getUserByEmail: defQuery<{ email: string }, UserDoc | null>("users", "getUserByEmail"),
  },

  sessions: {
    createSession: defMutation<
      {
        userId: Id<"users">;
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
    listSessions: defQuery<{ userId: Id<"users"> }, SessionDoc[]>("sessions", "listSessions"),
    listSessionsWithFeedback: defQuery<
      { userId: Id<"users"> },
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
    getGoal: defQuery<{ userId: Id<"users"> }, GoalDoc | null>("goals", "getGoal"),
    setGoal: defMutation<
      { userId: Id<"users">; targetOvr: number; deadline: string },
      Id<"goals">
    >("goals", "setGoal"),
  },

  badges: {
    getUserBadges: defQuery<{ userId: Id<"users"> }, BadgeDoc[]>(
      "badges",
      "getUserBadges"
    ),
    checkAndAwardBadges: defMutation<{ userId: Id<"users"> }, string[]>(
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
    getOrCreateIndex: defAction<{ sport: string }, string>(
      "twelvelabs",
      "getOrCreateIndex"
    ),
    indexVideo: defAction<
      {
        sessionId: Id<"sessions">;
        analysisId: Id<"analyses">;
        indexId: string;
      },
      string
    >("twelvelabs", "indexVideo"),
    getTaskStatus: defAction<
      {
        taskId: string;
        analysisId: Id<"analyses">;
        sessionId: Id<"sessions">;
      },
      { status: string; videoId: string | null }
    >("twelvelabs", "getTaskStatus"),
    analyzeVideo: defAction<
      { analysisId: Id<"analyses">; videoId: string; prompt: string },
      string
    >("twelvelabs", "analyzeVideo"),
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
