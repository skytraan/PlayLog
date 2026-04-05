import { Badge } from "@/types/playlog";
import { ALL_TENNIS_BADGES } from "@/data/mockData";
import { Lock } from "lucide-react";

interface BadgeGridProps {
  earnedBadges: Badge[];
}

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b]));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Badges</h3>
        <span className="text-xs text-muted-foreground">
          {earnedBadges.length} / {ALL_TENNIS_BADGES.length} unlocked
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_TENNIS_BADGES.map((badge) => {
          const earned = earnedMap.get(badge.id);
          return (
            <div
              key={badge.id}
              className={`border rounded-lg px-3 py-3 text-center transition-colors ${
                earned
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <div className={`text-2xl mb-1 ${!earned ? "grayscale opacity-30" : ""}`}>
                {badge.icon}
              </div>
              <div className={`text-xs font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                {badge.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {earned
                  ? new Date(earned.earnedDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : badge.description}
              </div>
              {!earned && (
                <div className="flex justify-center mt-1.5">
                  <Lock className="h-2.5 w-2.5 text-muted-foreground opacity-50" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
