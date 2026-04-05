import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Sport, ChatMessage, Session } from "@/types/playlog";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";
import { useState } from "react";

interface LearnProps {
  sport: Sport;
  userId: Id<"users">;
}

export function Learn({ sport, userId }: LearnProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const askCoach = useAction(api.gemini.askCoach);

  const { status, error, sessionId, analyze } = useVideoAnalysis({
    userId,
    sport,
    requestedSections: sport === "tennis"
      ? ["forehand", "backhand", "serve", "footwork"]
      : ["driving", "iron play", "short game", "putting"],
  });

  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });

  const sessions: Session[] = (rawSessions ?? []).map(({ session, feedback }) => ({
    id: session._id,
    profileId: session.userId,
    date: new Date(session.createdAt).toISOString(),
    sport: session.sport as Sport,
    durationMinutes: 0,
    overallRating: 0,
    ratings: [],
    weaknesses: feedback?.improvements ?? [],
    strengths: feedback?.strengths ?? [],
    drillRecommendations: feedback?.drills ?? [],
    nextChallenge: "",
    challengeResult: null,
    pegasusSummary: feedback?.summary ?? "",
  }));

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await askCoach({ sessionId, userMessage: content });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I couldn't process your message. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ]);
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
      />
    </div>
  );
}
