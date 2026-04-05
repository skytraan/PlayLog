import { PlayerCard, getRatingTier, getLevelTitle } from "@/types/playlog";

interface PlayerCardProps {
  card: PlayerCard;
}

export function PlayerCardComponent({ card }: PlayerCardProps) {
  const tier = getRatingTier(card.overallRating);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{card.playerName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
            {card.sport === "tennis" ? "🎾" : "⛳"} {card.sport} · {card.totalSessions} session{card.totalSessions !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold font-mono text-rating-${tier}`}>
            {card.overallRating}
          </div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-0.5">
            {getLevelTitle(card.overallRating)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-medium text-foreground">{card.streak}</span>
          <span className="text-xs text-muted-foreground">week streak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🏅</span>
          <span className="text-sm font-medium text-foreground">
            {card.badges.filter((b) => b.earnedDate).length}
          </span>
          <span className="text-xs text-muted-foreground">badges</span>
        </div>
      </div>

      {/* Skill Ratings */}
      <div className="px-5 py-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Skill Ratings
        </h4>
        <div className="space-y-2.5">
          {card.ratings.map((r) => (
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
    </div>
  );
}
