import { useRef, useState, useEffect } from "react";
import { api, useAction, useMutation, useQuery, type Id } from "@/lib/api";
import { Sport, ChatMessage, Session } from "@/types/playlog";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { VideoPlayer, VideoPlayerHandle } from "@/components/VideoPlayer";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface LearnProps {
  sport: Sport;
  userId: Id<"users">;
}

export function Learn({ sport, userId }: LearnProps) {
  const askCoach = useAction(api.coach.askCoach);
  const deleteSession = useMutation(api.sessions.deleteSession);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const { toast } = useToast();

  const { status, error, sessionId, currentVideo, analyze, reset } = useVideoAnalysis({
    userId,
    sport,
    // userId still threaded into the hook so the local-storage key for the
    // active-session cache stays per-user; it's no longer sent over the wire.
    requestedSections: sport === "tennis"
      ? ["forehand", "backhand", "serve", "footwork"]
      : sport === "basketball"
      ? ["shooting", "dribbling", "footwork", "defense"]
      : ["driving", "iron play", "short game", "putting"],
  });

  const [forceUpload, setForceUpload] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Track which session the user has selected in the library
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, {});

  // Priority: newly-uploaded session > user-selected > most recent
  const effectiveSessionId: Id<"sessions"> | null =
    sessionId ?? (selectedSessionId as Id<"sessions"> | null) ?? rawSessions?.[0]?.session._id ?? null;

  const persistedVideoUrl = useQuery(
    api.storage.getSessionVideoUrl,
    !forceUpload && !currentVideo && effectiveSessionId
      ? { sessionId: effectiveSessionId }
      : "skip"
  );

  const handleSwitchVideo = () => {
    setForceUpload(true);
    reset();
  };

  const handleUpload = async (file: File) => {
    setForceUpload(false);
    setSelectedSessionId(null);
    await analyze(file);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession({ sessionId: id as Id<"sessions"> });
      if (id === effectiveSessionId) {
        setForceUpload(true);
        setSelectedSessionId(null);
        reset();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
      toast({
        title: "Could not delete session",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleActivateSession = (id: string) => {
    setSelectedSessionId(id);
    setForceUpload(false);
  };

  const latestPoseAnalysis = rawSessions?.find((s) => s.session._id === effectiveSessionId)?.poseAnalysis ?? null;
  const cues: number[] = (() => {
    if (!latestPoseAnalysis) return [];
    try {
      const parsed = JSON.parse(latestPoseAnalysis);
      const results = Array.isArray(parsed) ? parsed : [parsed];
      return results.flatMap((r: { keyFrames?: Array<{ timestampMs: number }> }) =>
        (r.keyFrames ?? []).map((f) => f.timestampMs / 1000)
      );
    } catch {
      return [];
    }
  })();

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

  const latestFeedback = rawSessions?.[0]?.feedback;
  const presetPrompts: string[] = latestFeedback
    ? [
        ...latestFeedback.improvements.slice(0, 2).map((w) => `How do I fix: ${w}?`),
        ...latestFeedback.strengths.slice(0, 1).map((s) => `How do I build on: ${s}?`),
        latestFeedback.drills[0] ? `Walk me through this drill: ${latestFeedback.drills[0]}` : "",
      ].filter(Boolean)
    : [];

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

  // Clear isSending when new messages arrive
  useEffect(() => {
    if (messages.length > 0) setIsSending(false);
  }, [messages.length]);

  const handleSendMessage = async (content: string) => {
    if (!effectiveSessionId) return;
    setChatError(null);
    setIsSending(true);
    try {
      await askCoach({ sessionId: effectiveSessionId, userMessage: content });
    } catch {
      setChatError("Message failed to send. Please try again.");
      setIsSending(false);
    }
  };

  const handleSeek = (seconds: number) => {
    videoPlayerRef.current?.seekTo(seconds);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isDone = status === "ready";
  const isError = status === "error";

  const hasPlayableVideo = !forceUpload && (!!currentVideo || !!persistedVideoUrl);
  const showSwitchButton =
    hasPlayableVideo && (isDone || isError || (!currentVideo && !!persistedVideoUrl));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      {/* Left column: video + session library */}
      <div className="space-y-6 min-w-0">
        {hasPlayableVideo ? (
          <div className="space-y-2">
            <VideoPlayer
              ref={videoPlayerRef}
              file={currentVideo ?? undefined}
              src={!currentVideo ? persistedVideoUrl ?? undefined : undefined}
              cues={cues}
            />
            {showSwitchButton && (
              <button
                onClick={handleSwitchVideo}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Upload a different video
              </button>
            )}
          </div>
        ) : (
          <UploadArea status={status} onUpload={handleUpload} />
        )}

        {currentVideo && status !== "idle" && !isDone && !isError && (
          <ProcessingSteps status={status} />
        )}

        {isError && error && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl px-4 py-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-destructive">Analysis failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
            <button
              onClick={handleSwitchVideo}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors whitespace-nowrap flex-shrink-0"
            >
              Try again
            </button>
          </div>
        )}

        {rawSessions === undefined ? (
          <SessionLibrarySkeleton />
        ) : (
          <SessionLibrary
            sessions={sessions}
            activeSessionId={effectiveSessionId ?? undefined}
            onSeek={handleSeek}
            onActivate={handleActivateSession}
            onDelete={handleDeleteSession}
          />
        )}
      </div>

      {/* Right column: chat (sticky) */}
      <div className="sticky top-24 self-start">
        <ChatInterface
          messages={messages}
          onSend={handleSendMessage}
          sport={sport}
          disabled={!effectiveSessionId}
          isSending={isSending}
          presetPrompts={presetPrompts}
          onSeek={handleSeek}
          sendError={chatError}
        />
      </div>
    </div>
  );
}

function SessionLibrarySkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

const STEPS: Array<{ key: string; label: string; detail: string }> = [
  { key: "uploading", label: "Uploading video", detail: "Encrypted transfer to R2 storage" },
  { key: "analyzing", label: "Analyzing with Pegasus", detail: "Identifying strokes, positions, intent" },
  { key: "scoring",   label: "Generating coaching feedback", detail: "Cross-referencing technique guides" },
];

const STATUS_ORDER = ["uploading", "analyzing", "scoring", "ready"];

function ProcessingSteps({ status }: { status: string }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  return (
    <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = STATUS_ORDER[currentIndex] === step.key;
        return (
          <div key={step.key} className="flex items-start gap-3 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${
              done ? "bg-primary" : active ? "bg-primary animate-pulse" : "bg-border"
            }`} />
            <div className="flex-1">
              <div className={done || active ? "text-foreground font-medium" : "text-muted-foreground"}>
                {step.label}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{step.detail}</div>
            </div>
            {done && <span className="text-primary text-sm">✓</span>}
            {active && (
              <svg className="animate-spin h-3.5 w-3.5 text-primary flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
