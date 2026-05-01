import { useState } from "react";
import { Badge } from "@/types/playlog";
import { ALL_TENNIS_BADGES } from "@/data/mockData";

interface BadgeGridProps {
  earnedBadges: Badge[];
}

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b]));
  const earned = earnedBadges.length;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Badges</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {earned} of {ALL_TENNIS_BADGES.length} earned
          </p>
        </div>
        <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          View all
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {ALL_TENNIS_BADGES.map((badge) => {
          const earnedBadge = earnedMap.get(badge.id);
          const isEarned = !!earnedBadge;
          const isHover = hovered === badge.id;

          return (
            <button
              key={badge.id}
              onMouseEnter={() => setHovered(badge.id)}
              onMouseLeave={() => setHovered(null)}
              className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                isEarned
                  ? "bg-secondary border-border hover:border-primary/50"
                  : "bg-secondary/30 border-border/50 grayscale opacity-50 hover:opacity-80"
              }`}
            >
              <span className="text-2xl">{badge.icon}</span>
              <span className="text-[9px] font-semibold text-foreground/80 uppercase tracking-wide leading-tight text-center px-1">
                {badge.name}
              </span>

              {isHover && (
                <div className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 w-44 bg-popover border border-border rounded-lg p-2 text-left shadow-xl pointer-events-none">
                  <div className="text-[11px] font-semibold text-foreground">{badge.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{badge.description}</div>
                  {earnedBadge && (
                    <div className="text-[10px] text-primary mt-1">
                      Earned ·{" "}
                      {new Date(earnedBadge.earnedDate!).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
