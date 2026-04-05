import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Video, TrendingUp, Dumbbell } from "lucide-react";

export interface UserProfile {
  userId: Id<"users">;
  name: string;
  email: string;
  sport: "tennis";
}

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const features = [
  {
    icon: Video,
    title: "AI Video Analysis",
    desc: "Upload your footage and get a full technical breakdown of your game.",
  },
  {
    icon: TrendingUp,
    title: "Skill Ratings",
    desc: "Every session scores your key technical skills from 0–100 so you know exactly where you stand.",
  },
  {
    icon: Dumbbell,
    title: "Badges & Progression",
    desc: "Earn badges as you hit milestones and watch your player card level up over time.",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; submit?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const createUser = useMutation(api.users.createUser);

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Full name is required";
    } else if (name.trim().split(/\s+/).length < 2) {
      newErrors.name = "Please enter your first and last name";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email";
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitting(true);
    try {
      const userId = await createUser({
        name: name.trim(),
        email: email.trim(),
        sports: ["tennis"],
      });
      onComplete({ userId, name: name.trim(), email: email.trim(), sport: "tennis" });
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Failed to create account" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <div className="px-8 py-5 border-b border-border">
        <img src="/logo.png" alt="PlayLog" className="h-14 w-auto" />
      </div>

      <div className="flex flex-1">
      {/* Left — form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Get started</h1>
            <p className="mt-2 text-sm text-muted-foreground">Create your profile to begin tracking your game.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
                placeholder="Your full name"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Sport
              </label>
              <div className="w-full px-3 py-2 text-sm rounded-md border border-border bg-secondary text-foreground flex items-center gap-2">
                <span>🎾</span>
                <span>Tennis</span>
              </div>
            </div>

            {errors.submit && <p className="text-xs text-destructive">{errors.submit}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 px-4 py-2.5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Get started"}
            </button>
          </form>
        </div>
      </div>

      {/* Right — branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-card border-l border-border px-12 py-12">
        <div>
          <div className="text-4xl mb-6">🏆</div>
          <h2 className="text-3xl font-bold text-foreground leading-tight">
            Your AI sports<br />coach is here.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Upload your footage, get structured coaching feedback, and track your improvement — session by session.
          </p>

          <div className="mt-10 space-y-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Powered by TwelveLabs · Gemini · MediaPipe
        </p>
      </div>
      </div>
    </div>
  );
}
