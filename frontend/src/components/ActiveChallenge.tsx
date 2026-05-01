interface ActiveChallengeProps {
  challenge: string;
  setDate: string | null;
}

export function ActiveChallenge({ challenge, setDate }: ActiveChallengeProps) {
  return (
    <div
      className="border border-emerald-900/60 rounded-2xl px-5 py-4 flex items-center gap-4"
      style={{ background: "linear-gradient(90deg, hsl(153 50% 14%) 0%, hsl(222 18% 11%) 60%)" }}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-lg flex-shrink-0">
        🎯
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Active Challenge</span>
          {setDate && (
            <span className="text-[11px] text-muted-foreground">
              · set {new Date(setDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground truncate">{challenge}</p>
      </div>
    </div>
  );
}
