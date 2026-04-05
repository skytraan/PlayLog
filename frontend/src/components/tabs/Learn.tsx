import { useState } from "react";
import { Sport, AnalysisStatus, ChatMessage } from "@/types/playlog";
import { mockSessions, mockChatMessages } from "@/data/mockData";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { SessionDetail } from "@/components/SessionDetail";

interface LearnProps {
  profileId: string;
  sport: Sport;
}

export function Learn({ profileId, sport }: LearnProps) {
  const sessions = mockSessions[profileId] || [];
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

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

      {selectedSession ? (
        <SessionDetail
          session={selectedSession}
          onBack={() => setSelectedSessionId(null)}
        />
      ) : (
        <SessionLibrary
          sessions={sessions}
          onSelectSession={setSelectedSessionId}
        />
      )}

      <ChatInterface
        messages={messages}
        onSend={handleSendMessage}
        sport={sport}
      />
    </div>
  );
}
