import { useRef, useState } from "react";
import { api, useAction, useMutation, useQuery, type Id } from "@/lib/api";
import { Sport, ChatMessage, Session } from "@/types/playlog";
import { SessionLibrary } from "@/components/SessionLibrary";
import { UploadArea } from "@/components/UploadArea";
import { ChatInterface } from "@/components/ChatInterface";
import { VideoPlayer, VideoPlayerHandle } from "@/components/VideoPlayer";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";
import { Skeleton } from "@/components/ui/skeleton";

interface LearnProps {
  sport: Sport;
  userId: Id<"users">;
}

export function Learn({ sport, userId }: LearnProps) {
  const askCoach = useAction(api.coach.askCoach);
  const deleteSession = useMutation(api.sessions.deleteSession);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const { status, error, sessionId, currentVideo, analyze, reset } = useVideoAnalysis({
    userId,
    sport,
    requestedSections: sport === "tennis"
      ? ["forehand", "backhand", "serve", "footwork"]
      : sport === "basketball"
      ? ["shooting", "dribbling", "footwork", "defense"]
      : ["driving", "iron play", "short game", "putting"],
  });

  // When the user clicks "Upload a different video", reset() clears sessionId
  // and currentVideo — but effectiveSessionId would otherwise fall back to the
  // latest history session, snapping the player right back to the previous
  // video. This flag forces the upload area open until the next upload.
  const [forceUpload, setForceUpload] = useState(false);

  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });

  const effectiveSessionId: Id<"sessions"> | null =
    sessionId ?? rawSessions?.[0]?.session._id ?? null;

  // Rehydrate the video from R2 when we don't have the original File in
  // memory — covers tab switches and full reloads. The local File takes
  // precedence (cheaper, no presign round-trip) when it's present. Skip the
  // query entirely when the user is asking to swap videos.
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
    await analyze(file);
  };

  // Deleting the active session would leave the player pointed at a row that
  // no longer exists; reset local state to drop back into upload mode.
  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession({ sessionId: id as Id<"sessions"> });
      if (id === effectiveSessionId) {
        setForceUpload(true);
        reset();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
      window.alert("Could not delete that session — try again.");
    }
  };

  // Extract MediaPipe cue timestamps (in seconds) from the most-recent analysis
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

  const handleSendMessage = async (content: string) => {
    if (!effectiveSessionId) return;
    try {
      await askCoach({ sessionId: effectiveSessionId, userMessage: content });
    } catch {
      // no-op: failed reply won't appear
    }
  };

  // Seek handler passed to SessionLibrary so timestamp chips can jump the video
  const handleSeek = (seconds: number) => {
    videoPlayerRef.current?.seekTo(seconds);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isDone = status === "ready";
  const isError = status === "error";

  // Either we have the freshly-uploaded File, or we have a persisted session
  // whose video lives in R2 — show the player in either case so the user can
  // keep referencing it across navigation and reloads.
  const hasPlayableVideo = !forceUpload && (!!currentVideo || !!persistedVideoUrl);
  const showSwitchButton =
    hasPlayableVideo && (isDone || isError || (!currentVideo && !!persistedVideoUrl));

  return (
    <div className="space-y-6">
      {/* Video player — shown when a file is selected OR a session is persisted */}
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

      {/* Processing status overlay when video is selected but not yet ready */}
      {currentVideo && status !== "idle" && !isDone && !isError && (
        <ProcessingSteps status={status} />
      )}

      {error && (
        <p className="text-xs text-destructive px-1">{error}</p>
      )}

      {rawSessions === undefined ? (
        <SessionLibrarySkeleton />
      ) : (
        <SessionLibrary sessions={sessions} onSeek={handleSeek} onDelete={handleDeleteSession} />
      )}

      <ChatInterface
        messages={messages}
        onSend={handleSendMessage}
        sport={sport}
        disabled={!effectiveSessionId}
        presetPrompts={presetPrompts}
        onSeek={handleSeek}
      />
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

const STEPS: Array<{ key: string; label: string }> = [
  { key: "uploading", label: "Uploading video" },
  { key: "analyzing", label: "Analyzing with Pegasus" },
  { key: "scoring",   label: "Generating coaching feedback" },
];

const STATUS_ORDER = ["uploading", "analyzing", "scoring", "ready"];

function ProcessingSteps({ status }: { status: string }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  return (
    <div className="border border-border rounded-lg bg-card px-4 py-3 space-y-2">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = STATUS_ORDER[currentIndex] === step.key;
        return (
          <div key={step.key} className="flex items-center gap-2.5 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              done ? "bg-primary" : active ? "bg-primary animate-pulse" : "bg-border"
            }`} />
            <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
              {step.label}
            </span>
            {done && <span className="text-primary ml-auto">✓</span>}
          </div>
        );
      })}
    </div>
  );
}
