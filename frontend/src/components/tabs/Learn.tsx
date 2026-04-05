import { useState } from "react";
import { Sport, AnalysisStatus, ChatMessage } from "@/types/playlog";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";

interface LearnProps {
  sport: Sport;
}

export function Learn({ sport }: LearnProps) {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleUpload = () => {
    setAnalysisStatus("uploading");
    setTimeout(() => setAnalysisStatus("analyzing"), 1500);
    setTimeout(() => setAnalysisStatus("scoring"), 4000);
    setTimeout(() => setAnalysisStatus("ready"), 6000);
    setTimeout(() => setAnalysisStatus("idle"), 7000);
  };

  const handleSendMessage = (content: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const reply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          "Based on your session history, I can see steady improvement in your technique. Your most recent session shows the strongest fundamentals yet — particularly in your preparation timing. Keep focusing on the areas we identified and you'll continue to see progress.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <UploadArea status={analysisStatus} onUpload={handleUpload} />

      <SessionLibrary sessions={[]} />

      <ChatInterface
        messages={messages}
        onSend={handleSendMessage}
        sport={sport}
      />
    </div>
  );
}
