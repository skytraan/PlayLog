import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Sport, ChatMessage, Session } from "@/types/playlog";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";

interface LearnProps {
  sport: Sport;
  userId: Id<"users">;
}

export function Learn({ sport, userId }: LearnProps) {
  const askCoach = useAction(api.gemini.askCoach);

  const { status, error, sessionId, analyze } = useVideoAnalysis({
    userId,
    sport,
    requestedSections: sport === "tennis"
      ? ["forehand", "backhand", "serve", "footwork"]
      : ["driving", "iron play", "short game", "putting"],
  });

  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });

  // Prefer the freshly-analyzed session; fall back to the most recent stored session
  const effectiveSessionId: Id<"sessions"> | null =
    sessionId ?? rawSessions?.[0]?.session._id ?? null;

  const sessions: Session[] = (rawSessions ?? []).map(({ session, feedback, overallScore }) => ({
    id: session._id,
    profileId: session.userId,
    date: new Date(session.createdAt).toISOString(),
    sport: session.sport as Sport,
    durationMinutes: 0,
    overallRating: overallScore ?? 0,
    ratings: [],
    weaknesses: feedback?.improvements ?? [],
    strengths: feedback?.strengths ?? [],
    drillRecommendations: feedback?.drills ?? [],
    nextChallenge: "",
    challengeResult: null,
    pegasusSummary: feedback?.summary ?? "",
  }));

  // Derive preset prompts from the most recent session's feedback
  const latestFeedback = rawSessions?.[0]?.feedback;
  const presetPrompts: string[] = latestFeedback
    ? [
        ...latestFeedback.improvements.slice(0, 2).map((w) => `How do I fix: ${w}?`),
        ...latestFeedback.strengths.slice(0, 1).map((s) => `How do I build on: ${s}?`),
        latestFeedback.drills[0] ? `Walk me through this drill: ${latestFeedback.drills[0]}` : "",
      ].filter(Boolean)
    : [];

  // Load chat messages from Convex reactively — auto-updates when askCoach saves replies
  const storedMessages = useQuery(
    api.messages.getMessages,
    effectiveSessionId ? { sessionId: effectiveSessionId } : "skip"
  );

  const messages: ChatMessage[] = (storedMessages ?? []).map((msg) => ({
    id: msg._id,
    role: msg.role === "model" ? "assistant" : ("user" as const),
    content: msg.content,
    timestamp: new Date(msg.createdAt).toISOString(),
  }));

  const handleSendMessage = async (content: string) => {
    if (!effectiveSessionId) return;
    try {
      await askCoach({ sessionId: effectiveSessionId, userMessage: content });
    } catch {
      // askCoach saves the user message and reply to Convex; on error the reply
      // won't appear — no local state to clean up
    }
  };

  return (
    <div className="space-y-6">
      <UploadArea status={status} onUpload={analyze} />

      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}

      <SessionLibrary sessions={sessions} />

      <ChatInterface
        messages={messages}
        onSend={handleSendMessage}
        sport={sport}
        disabled={!effectiveSessionId}
        presetPrompts={presetPrompts}
      />
    </div>
  );
}
