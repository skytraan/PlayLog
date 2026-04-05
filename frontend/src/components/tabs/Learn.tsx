import { useState } from "react";
import { ConvexReactClient } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Sport, AnalysisStatus, ChatMessage } from "@/types/playlog";
import { UserProfile } from "@/components/Onboarding";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { pollUntilReady } from "@/lib/twelvelabs/videoIndexer";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

interface LearnProps {
  sport: Sport;
  user: UserProfile;
}

export function Learn({ sport, user }: LearnProps) {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleUpload = async (file: File) => {
    setAnalysisStatus("uploading");
    try {
      // Get or create the Convex user
      const existing = await convex.query(api.users.getUserByEmail, { email: user.email });
      const userId = existing
        ? existing._id
        : await convex.mutation(api.users.createUser, {
            name: user.name,
            email: user.email,
            sports: [user.sport],
          });

      // Upload video to Convex storage
      const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
      const { storageId } = await uploadRes.json();

      // Create session and analysis records
      const sessionId = await convex.mutation(api.sessions.createSession, {
        userId,
        sport: user.sport,
        videoStorageId: storageId,
        requestedSections: ["technique", "footwork", "strategy"],
      });
      const analysisId = await convex.mutation(api.analyses.createAnalysis, { sessionId });

      // Kick off TwelveLabs indexing
      setAnalysisStatus("analyzing");
      const indexId = await convex.action(api.twelvelabs.getOrCreateIndex, { sport: user.sport });
      const taskId = await convex.action(api.twelvelabs.indexVideo, {
        sessionId,
        analysisId,
        indexId,
      });

      // Poll until indexing completes
      setAnalysisStatus("scoring");
      await pollUntilReady(convex, { taskId, sessionId, analysisId });

      setAnalysisStatus("ready");
    } catch (err) {
      console.error("Upload failed:", err);
      setAnalysisStatus("error");
    }
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
