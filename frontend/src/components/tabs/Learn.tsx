import { useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Sport, ChatMessage } from "@/types/playlog";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const askCoach = useAction(api.gemini.askCoach);

  const { status, error, sessionId, analyze } = useVideoAnalysis({
    userId,
    sport,
    requestedSections: sport === "tennis"
      ? ["forehand", "backhand", "serve", "footwork"]
      : ["driving", "iron play", "short game", "putting"],
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await analyze(file);
  };

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
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo"
        className="hidden"
        onChange={handleFileChange}
      />

      <UploadArea status={status} onUpload={handleUploadClick} />

      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}

      <SessionLibrary sessions={[]} />

      <ChatInterface
        messages={messages}
        onSend={handleSendMessage}
        sport={sport}
      />
    </div>
  );
}
