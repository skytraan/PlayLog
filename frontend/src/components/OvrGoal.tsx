import { useState, useEffect } from "react";
import { api, useMutation, useQuery } from "@/lib/api";
import { Target, Pencil, X } from "lucide-react";

interface OvrGoalProps {
  currentOvr: number;
  totalSessions?: number;
  streak?: number;
  earnedBadgesCount?: number;
  totalBadges?: number;
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        <span className="text-sm">{icon}</span>
        {label}
      </div>
      <div className="text-xl font-bold font-mono text-foreground">{value}</div>
    </div>
  );
}

export function OvrGoal({
  currentOvr,
  totalSessions = 0,
  streak = 0,
  earnedBadgesCount = 0,
  totalBadges = 0,
}: OvrGoalProps) {
  const savedGoal = useQuery(api.goals.getGoal, {});
  const saveGoal = useMutation(api.goals.setGoal);

  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [errors, setErrors] = useState<{ target?: string; deadline?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (editing && savedGoal) {
      setTargetInput(String(savedGoal.targetOvr));
      setDeadlineInput(savedGoal.deadline);
    }
  }, [editing, savedGoal]);

  const validate = () => {
    const newErrors: { target?: string; deadline?: string } = {};
    const target = Number(targetInput);
    if (!targetInput || isNaN(target) || target < 1 || target > 100) {
      newErrors.target = "Enter a target OVR between 1 and 100";
    } else if (target <= currentOvr) {
      newErrors.target = "Target must be higher than your current OVR";
    }
    if (!deadlineInput) {
      newErrors.deadline = "Select a deadline";
    } else if (new Date(deadlineInput) <= new Date()) {
      newErrors.deadline = "Deadline must be in the future";
    }
    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveGoal({ targetOvr: Number(targetInput), deadline: deadlineInput });
      setEditing(false);
      setErrors({});
    } catch {
      setSaveError("Could not save goal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setErrors({});
    setSaveError(null);
  };

  const daysLeft = savedGoal
    ? Math.ceil((new Date(savedGoal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const progress = savedGoal
    ? Math.min(100, Math.round((currentOvr / savedGoal.targetOvr) * 100))
    : 0;

  if (savedGoal === undefined) return null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OVR Goal</h3>
        </div>
        {savedGoal && !editing && (
          <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="px-5 py-4 flex-1 flex flex-col">
        {!savedGoal && !editing && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <p className="text-sm text-muted-foreground mb-3 text-center">Set a target OVR score to work towards.</p>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Set goal
            </button>
          </div>
        )}

        {editing && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Target OVR (current: {currentOvr || "—"})
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={targetInput}
                onChange={(e) => { setTargetInput(e.target.value); setErrors((p) => ({ ...p, target: undefined })); }}
                placeholder="e.g. 75"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.target && <p className="mt-1 text-xs text-destructive">{errors.target}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadlineInput}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => { setDeadlineInput(e.target.value); setErrors((p) => ({ ...p, deadline: undefined })); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.deadline && <p className="mt-1 text-xs text-destructive">{errors.deadline}</p>}
            </div>
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {savedGoal && !editing && (
          <div className="flex flex-col gap-4 flex-1">
            {/* Current + Goal */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current</p>
                <p className="text-2xl font-bold font-mono text-primary mt-0.5">{currentOvr || "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">OVR Goal</p>
                <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{savedGoal.targetOvr}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="relative mb-1.5">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div
                  className="absolute -top-1 -translate-x-1/2 transition-all duration-700"
                  style={{ left: `${Math.min(100, Math.max(0, progress))}%` }}
                >
                  <div className="w-4 h-4 rounded-full bg-primary border-2 border-background shadow" />
                </div>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>0 · start</span>
                <span className="text-foreground font-semibold">{currentOvr} · now</span>
                <span>{savedGoal.targetOvr} · goal</span>
              </div>
              {daysLeft !== null && (
                <p className={`text-[11px] mt-1 ${daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} until deadline` : "Deadline passed"}
                </p>
              )}
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border mt-auto">
              <MiniStat icon="📹" label="Sessions" value={totalSessions} />
              <MiniStat icon="🔥" label="Streak" value={streak > 0 ? `${streak} wk` : "—"} />
              <MiniStat icon="🏅" label="Badges" value={totalBadges > 0 ? `${earnedBadgesCount}/${totalBadges}` : earnedBadgesCount} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
