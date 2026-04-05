import { Session } from "@/types/playlog";
import { ArrowLeft } from "lucide-react";

interface SessionDetailProps {
  session: Session;
  onBack: () => void;
}

export function SessionDetail({ session, onBack }: SessionDetailProps) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sessions
      </button>

      <div className="border border-border rounded-lg bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {new Date(session.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.durationMinutes} min · Overall: {session.overallRating}
            </p>
          </div>
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

        <div className="px-4 py-4 space-y-5">
          {/* Skill Ratings */}
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
                      className="h-full bg-foreground rounded-full"
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Strengths
              </h4>
              <ul className="space-y-1">
                {session.strengths.map((s) => (
                  <li key={s} className="text-sm text-foreground">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Weaknesses
              </h4>
              <ul className="space-y-1">
                {session.weaknesses.map((w) => (
                  <li key={w} className="text-sm text-foreground">
                    {w}
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
              {session.drillRecommendations.map((d, i) => (
                <div key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-muted-foreground font-mono text-xs mt-0.5">{i + 1}</span>
                  {d}
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
      </div>
    </div>
  );
}
