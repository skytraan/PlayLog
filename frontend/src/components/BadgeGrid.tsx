import { Badge } from "@/types/playlog";

interface BadgeGridProps {
  badges: Badge[];
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Badges</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {badges.map((badge) => {
          const earned = !!badge.earnedDate;
          return (
            <div
              key={badge.id}
              className={`border border-border rounded-lg px-3 py-3 text-center ${
                earned ? "bg-card" : "bg-secondary opacity-50"
              }`}
            >
              <div className="text-2xl mb-1">{badge.icon}</div>
              <div className={`text-xs font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                {badge.name}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {earned
                  ? new Date(badge.earnedDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
