import { useState, useEffect } from "react";
import { api, useMutation, useQuery, type Id } from "@/lib/api";
import { Target, Pencil, X } from "lucide-react";

interface OvrGoalProps {
  userId: Id<"users">;
  currentOvr: number;
}

export function OvrGoal({ userId, currentOvr }: OvrGoalProps) {
  const savedGoal = useQuery(api.goals.getGoal, { userId });
  const saveGoal = useMutation(api.goals.setGoal);

  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [errors, setErrors] = useState<{ target?: string; deadline?: string }>({});
  const [saving, setSaving] = useState(false);

  // Pre-fill inputs when editing an existing goal
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
    try {
      await saveGoal({ userId, targetOvr: Number(targetInput), deadline: deadlineInput });
      setEditing(false);
      setErrors({});
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setErrors({});
  };

  const daysLeft = savedGoal
    ? Math.ceil((new Date(savedGoal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const progress = savedGoal
    ? Math.min(100, Math.round((currentOvr / savedGoal.targetOvr) * 100))
    : 0;

  if (savedGoal === undefined) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
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

      <div className="px-5 py-4">
        {!savedGoal && !editing && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">Set a target OVR score to work towards.</p>
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
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {errors.deadline && <p className="mt-1 text-xs text-destructive">{errors.deadline}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {savedGoal && !editing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="text-2xl font-bold font-mono text-foreground">{savedGoal.targetOvr}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(savedGoal.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${daysLeft !== null && daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "Deadline passed"}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-xs font-medium text-foreground">{currentOvr} / {savedGoal.targetOvr}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: progress >= 100 ? "#22c55e" : progress >= 60 ? "#eab308" : "#3b82f6",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{progress}% of the way there</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
