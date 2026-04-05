import { AnalysisStatus } from "@/types/playlog";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";

interface UploadAreaProps {
  status: AnalysisStatus;
  onUpload: () => void;
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
  const isProcessing = status !== "idle" && status !== "ready" && status !== "error";
  const isDone = status === "ready";

  return (
    <div className="border border-dashed border-border rounded-lg bg-card">
      {status === "idle" ? (
        <button
          onClick={onUpload}
          className="w-full px-4 py-8 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors rounded-lg"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Upload session footage</span>
          <span className="text-xs text-muted-foreground">MP4, MOV, or AVI — drag and drop or click to browse</span>
        </button>
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
  );
}
