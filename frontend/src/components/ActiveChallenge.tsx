import { Target } from "lucide-react";

interface ActiveChallengeProps {
  challenge: string;
  setDate: string | null;
}

export function ActiveChallenge({ challenge, setDate }: ActiveChallengeProps) {
  return (
    <div className="border border-border rounded-lg bg-card px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-secondary rounded-md">
          <Target className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Active Challenge
            </h4>
            {setDate && (
              <span className="text-[10px] text-muted-foreground">
                Set {new Date(setDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground">{challenge}</p>
        </div>
      </div>
    </div>
  );
}
