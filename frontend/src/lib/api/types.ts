// ID and row types — wire-compatible with the old convex/_generated/dataModel.
// Frontend code that imported `Id<"users">` etc. continues to typecheck because
// every Id<T> is just a branded string.

declare const __idBrand: unique symbol;

export type Id<T extends string> = string & { readonly [__idBrand]: T };

// ─── Row shapes (mirror server/src/db/types.ts) ─────────────────────────────

export type SessionStatus = "uploading" | "processing" | "complete" | "error";
export type MessageRole = "user" | "model";

export interface UserDoc {
  _id: Id<"users">;
  _creationTime: number;
  name: string;
  email: string;
  sports: string[];
  createdAt: number;
}

export interface SessionDoc {
  _id: Id<"sessions">;
  _creationTime: number;
  userId: Id<"users">;
  sport: string;
  videoStorageId: Id<"_storage">;
  requestedSections: string[];
  status: SessionStatus;
  errorMessage?: string;
  createdAt: number;
}

export interface AnalysisDoc {
  _id: Id<"analyses">;
  _creationTime: number;
  sessionId: Id<"sessions">;
  twelveLabsIndexId?: string | null;
  twelveLabsVideoId?: string | null;
  twelveLabsResult?: string | null;
  poseAnalysis?: string | null;
  overallScore?: number | null;
  technique?: string | null;
  createdAt: number;
}

export interface MessageDoc {
  _id: Id<"messages">;
  _creationTime: number;
  sessionId: Id<"sessions">;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface GoalDoc {
  _id: Id<"goals">;
  _creationTime: number;
  userId: Id<"users">;
  targetOvr: number;
  deadline: string;
  createdAt: number;
  updatedAt: number;
}

export interface BadgeDoc {
  _id: Id<"badges">;
  _creationTime: number;
  userId: Id<"users">;
  badgeId: string;
  earnedAt: number;
}

export interface FeedbackDoc {
  _id: Id<"feedback">;
  _creationTime: number;
  sessionId: Id<"sessions">;
  analysisId: Id<"analyses">;
  summary: string;
  strengths: string[];
  improvements: string[];
  drills: string[];
  createdAt: number;
}

export interface SessionWithFeedback {
  session: SessionDoc;
  feedback: FeedbackDoc | null;
  overallScore: number | null;
  technique: string | null;
  poseAnalysis: string | null;
}

// ─── Endpoint descriptor ────────────────────────────────────────────────────

// `__args` and `__result` are phantom — only used by useQuery/useMutation/useAction
// to infer the request and response types. They're never actually populated.
export interface EndpointDef<TArgs, TResult> {
  module: string;
  name: string;
  /** mutating endpoints invalidate the query cache after running */
  mutates: boolean;
  __args?: TArgs;
  __result?: TResult;
}

export type ArgsOf<E> = E extends EndpointDef<infer A, unknown> ? A : never;
export type ResultOf<E> = E extends EndpointDef<unknown, infer R> ? R : never;

export function defQuery<TArgs, TResult>(
  module: string,
  name: string
): EndpointDef<TArgs, TResult> {
  return { module, name, mutates: false };
}

export function defMutation<TArgs, TResult>(
  module: string,
  name: string
): EndpointDef<TArgs, TResult> {
  return { module, name, mutates: true };
}

// Actions in Convex don't auto-invalidate. Ours do — every action we have
// either writes to the DB itself (gemini, twelvelabs status updates) or
// triggers cascading data changes the UI cares about, so a wholesale
// invalidate-all is the simplest correct choice.
export function defAction<TArgs, TResult>(
  module: string,
  name: string
): EndpointDef<TArgs, TResult> {
  return { module, name, mutates: true };
}
