import { useState } from "react";
import { Session, ratingBarColor } from "@/types/playlog";
import { FeedbackText } from "@/lib/timestamps";

interface SessionLibraryProps {
  sessions: Session[];
  activeSessionId?: string;
  onSeek?: (seconds: number) => void;
  onActivate?: (id: string) => void;
  onDelete?: (sessionId: string) => Promise<void> | void;
}

const COURT_PALETTES = [
  { c: "#3b6939", l: "#86b27a" },
  { c: "#2d4f78", l: "#7396b8" },
  { c: "#5a3520", l: "#a87858" },
];

function CourtThumbnail({ index }: { index: number }) {
  const p = COURT_PALETTES[index % 3];
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-full">
      <rect width="100" height="60" fill={p.c} />
      <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.4" fill="none">
        <rect x="20" y="8" width="60" height="44" />
        <line x1="20" y1="22" x2="80" y2="22" />
        <line x1="20" y1="38" x2="80" y2="38" />
        <line x1="50" y1="22" x2="50" y2="38" />
        <line x1="50" y1="8" x2="50" y2="52" strokeDasharray="1 1" />
      </g>
      <line x1="50" y1="0" x2="50" y2="60" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
      <circle cx="36" cy="30" r="1.4" fill={p.l} />
    </svg>
  );
}

export function SessionLibrary({
  sessions,
  activeSessionId,
  onSeek,
  onActivate,
  onDelete,
}: SessionLibraryProps) {
  const [sortNewest, setSortNewest] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = sortNewest ? [...sessions] : [...sessions].reverse();

  const toggleDetails = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Session library</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setSortNewest((p) => !p)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Sort: {sortNewest ? "Newest" : "Oldest"} ▾
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">No sessions yet. Upload your first video to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((session, i) => {
            const isActive = session.id === activeSessionId;
            const isOpen = openIds.has(session.id);
            const globalIndex = sessions.indexOf(session);

            return (
              <div key={session.id}>
                {/* Session row */}
                <div
                  className={`px-5 py-3 flex items-center gap-4 transition-colors cursor-pointer ${
                    isActive ? "bg-secondary/50" : "hover:bg-secondary/30"
                  }`}
                  onClick={() => onActivate?.(session.id)}
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-12 rounded-md overflow-hidden flex-shrink-0 border border-border relative">
                    <CourtThumbnail index={globalIndex} />
                    {isActive && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Now</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {new Date(session.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {session.challengeResult === true && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Challenge ✓
                        </span>
                      )}
                    </div>
                    {session.pegasusSummary && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{session.pegasusSummary}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-muted-foreground">
                      {session.durationMinutes > 0 && <span>{session.durationMinutes}m</span>}
                      <span>{session.sport}</span>
                    </div>
                  </div>

                  {/* OVR + Details */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {session.overallRating > 0 && (
                      <div className="text-right">
                        <div
                          className="text-xl font-bold font-mono leading-none"
                          style={{ color: ratingBarColor(session.overallRating) }}
                        >
                          {session.overallRating}
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">OVR</div>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDetails(session.id);
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors text-foreground whitespace-nowrap"
                    >
                      {isOpen ? "Close ↑" : "Details →"}
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-border px-5 py-4 space-y-5 bg-background/30">
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
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{ width: `${r.score}%`, backgroundColor: ratingBarColor(r.score) }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Strengths & Weaknesses */}
                    {(session.strengths.length > 0 || session.weaknesses.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {session.strengths.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              What's working
                            </h4>
                            <ul className="space-y-1.5">
                              {session.strengths.map((s) => (
                                <li key={s} className="flex items-start gap-2 text-sm text-foreground">
                                  <span className="text-primary mt-0.5">✓</span>
                                  <FeedbackText text={s} onSeek={onSeek} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {session.weaknesses.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              What to work on
                            </h4>
                            <ul className="space-y-1.5">
                              {session.weaknesses.map((w) => (
                                <li key={w} className="flex items-start gap-2 text-sm text-foreground">
                                  <span className="text-amber-400 mt-0.5">○</span>
                                  <FeedbackText text={w} onSeek={onSeek} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Drills */}
                    {session.drillRecommendations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Recommended Drills
                        </h4>
                        <ol className="space-y-2">
                          {session.drillRecommendations.map((d, idx) => (
                            <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                              <span className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <FeedbackText text={d} onSeek={onSeek} />
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Next Challenge */}
                    {session.nextChallenge && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">
                          Next session challenge
                        </div>
                        <p className="text-sm text-foreground">{session.nextChallenge}</p>
                      </div>
                    )}

                    {/* Delete */}
                    {onDelete && (
                      <div className="pt-2 border-t border-border">
                        {confirmDeleteId === session.id ? (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Delete this session and its video?</span>
                            <button
                              disabled={deletingId === session.id}
                              onClick={async () => {
                                setDeletingId(session.id);
                                setConfirmDeleteId(null);
                                try {
                                  await onDelete(session.id);
                                } finally {
                                  setDeletingId(null);
                                }
                              }}
                              className="text-xs text-destructive font-medium hover:underline disabled:opacity-50"
                            >
                              {deletingId === session.id ? "Deleting…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={deletingId === session.id}
                            onClick={() => setConfirmDeleteId(session.id)}
                            className="text-xs text-destructive hover:underline disabled:opacity-50"
                          >
                            Delete session
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
