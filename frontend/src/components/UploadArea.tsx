import { useRef } from "react";
import { AnalysisStatus } from "@/types/playlog";
import { Upload, Loader2, CheckCircle2, Video } from "lucide-react";

interface UploadAreaProps {
  status: AnalysisStatus;
  onUpload: (file: File) => void;
}

const statusLabels: Record<AnalysisStatus, string> = {
  idle: "",
  uploading: "Uploading video…",
  analyzing: "Analyzing footage with Pegasus…",
  scoring: "Generating coaching scores…",
  ready: "Analysis complete",
  error: "Analysis failed. Please try again.",
};

export function UploadArea({ status, onUpload }: UploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = status !== "idle" && status !== "ready" && status !== "error";
  const isDone = status === "ready";

  return (
    <div className="space-y-3">
      <div className="border border-dashed border-border rounded-lg bg-card">
        {status === "idle" ? (
          <>
            {/*
              `accept="video/*"` (instead of a comma-separated mp4/mov/avi list)
              + `capture="environment"` makes iOS Safari and Android Chrome offer
              "Take Video" alongside "Photo Library" directly from the system
              picker — no extra "choose camera" step on the page itself. Desktop
              browsers ignore `capture` and continue to behave like a normal
              file dialog.
            */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 sm:py-8 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors rounded-lg min-h-[120px]"
            >
              <Upload className="h-6 w-6 sm:h-5 sm:w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Tap to record or upload</span>
              <span className="text-xs text-muted-foreground text-center px-2">MP4, MOV, or AVI — drag &amp; drop on desktop, or use your camera on mobile</span>
            </button>
          </>
        ) : (
          <div className="px-4 py-6 flex items-center justify-center gap-3">
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {isDone && <CheckCircle2 className="h-4 w-4 text-primary" />}
            <span className={`text-sm font-medium ${isDone ? "text-primary" : "text-muted-foreground"}`}>
              {statusLabels[status]}
            </span>
          </div>
        )}
      </div>

      {/* Recording tips */}
      {status === "idle" && (
        <div className="border border-border rounded-lg bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Video className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Recording tips</span>
          </div>
          <ul className="space-y-1">
            {[
              "Film from behind or the side — both angles work",
              "Keep your full body in frame throughout the shot",
              "5–15 minutes of footage gives the best analysis",
              "Good lighting significantly improves accuracy",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 text-primary">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
