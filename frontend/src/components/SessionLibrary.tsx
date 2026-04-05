import { Session } from "@/types/playlog";
import { getRatingTier } from "@/types/playlog";
import { ChevronRight } from "lucide-react";

interface SessionLibraryProps {
  sessions: Session[];
  onSelectSession: (id: string) => void;
}

export function SessionLibrary({ sessions, onSelectSession }: SessionLibraryProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No sessions yet. Upload your first video to get started.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Sessions</h3>
      <div className="space-y-2">
        {sessions.map((session) => {
          const tier = getRatingTier(session.overallRating);
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {new Date(session.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {session.durationMinutes} min
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-semibold font-mono text-rating-${tier}`}>
                  {session.overallRating}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
