import { useState } from "react";
import { api, setAuthToken, useMutation } from "@/lib/api";
import type { UserProfile } from "@/components/Onboarding";

interface LoginProps {
  onComplete: (profile: UserProfile) => void;
  onSwitchToSignup: () => void;
}

// Demo "sign in as" — accepts an email, hits /api/auth/login, stores the
// returned token and bounces to the app. Matches the lightweight login path
// called for in issue #27 (real product gets OAuth/SSO before launch).
export function Login({ onComplete, onSwitchToSignup }: LoginProps) {
  const login = useMutation(api.auth.login);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const { token, user } = await login({ email: email.trim() });
      setAuthToken(token);
      onComplete({
        userId: user._id,
        name: user.name,
        email: user.email,
        sport: "tennis",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="PlayLog" className="h-12 w-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with your email to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-base sm:text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] sm:min-h-0"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={onSwitchToSignup}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            New here? <span className="text-primary font-medium">Create an account</span>
          </button>
        </form>
      </div>
    </div>
  );
}
