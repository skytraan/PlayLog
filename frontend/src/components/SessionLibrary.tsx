import { useState } from "react";
import { Session, getRatingTier, ratingBarColor } from "@/types/playlog";
import { ChevronDown } from "lucide-react";
import { FeedbackText } from "@/lib/timestamps";

interface SessionLibraryProps {
  sessions: Session[];
  onSeek?: (seconds: number) => void;
}

export function SessionLibrary({ sessions, onSeek }: SessionLibraryProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No sessions yet. Upload your first video to get started.
      </div>
    );
  }

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Sessions</h3>
      <div className="space-y-2">
        {sessions.map((session, i) => {
          const sessionNumber = sessions.length - i;
          const tier = getRatingTier(session.overallRating);
          const isOpen = openIds.has(session.id);
          return (
            <div key={session.id} className="border border-border rounded-lg bg-card overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => toggle(session.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Session {sessionNumber} · {new Date(session.date).toLocaleDateString("en-US", {
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
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Expandable detail */}
              {isOpen && (
                <div className="border-t border-border px-4 py-4 space-y-5">
                  {/* Header info */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })} · {session.durationMinutes} min · Overall: {session.overallRating}
                    </p>
                    {session.challengeResult !== null && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                        session.challengeResult
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {session.challengeResult ? "Challenge met ✓" : "Challenge missed"}
                      </span>
                    )}
                  </div>

                  {/* Skill Ratings */}
                  {session.ratings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Skill Breakdown
                      </h4>
                      <div className="space-y-2.5">
                        {session.ratings.map((r) => (
                          <div key={r.name}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-foreground">{r.name}</span>
                              <span className="text-sm font-mono font-medium text-foreground">{r.score}</span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${r.score}%`, backgroundColor: ratingBarColor(r.score) }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Strengths
                      </h4>
                      <ul className="space-y-1.5">
                        {session.strengths.map((s) => (
                          <li key={s} className="text-sm text-foreground">
                            <FeedbackText text={s} onSeek={onSeek} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Weaknesses
                      </h4>
                      <ul className="space-y-1.5">
                        {session.weaknesses.map((w) => (
                          <li key={w} className="text-sm text-foreground">
                            <FeedbackText text={w} onSeek={onSeek} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Drills */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Recommended Drills
                    </h4>
                    <div className="space-y-1">
                      {session.drillRecommendations.map((d, idx) => (
                        <div key={idx} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-muted-foreground font-mono text-xs mt-0.5">{idx + 1}</span>
                          <FeedbackText text={d} onSeek={onSeek} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Challenge */}
                  {session.nextChallenge && (
                    <div className="bg-secondary rounded-lg px-4 py-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Next Session Challenge
                      </h4>
                      <p className="text-sm text-foreground">{session.nextChallenge}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
