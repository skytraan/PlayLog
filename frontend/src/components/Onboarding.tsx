import { useState } from "react";

export interface UserProfile {
  name: string;
  email: string;
  sport: "tennis";
}

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Enter a valid email";
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onComplete({ name: name.trim(), email: email.trim(), sport: "tennis" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to Playlog</h1>
          <p className="mt-2 text-sm text-muted-foreground">Let's set up your profile to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
              placeholder="Your name"
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

          <button
            type="submit"
            className="w-full mt-2 px-4 py-2 text-sm font-medium rounded-md bg-foreground text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get started
          </button>
        </form>
      </div>
    </div>
  );
}
