import { useEffect, useState } from "react";
import {
  api,
  getAuthToken,
  onUnauthorized,
  setAuthToken,
  useQuery,
  type Id,
} from "@/lib/api";
import AppLayout from "@/components/AppLayout";
import { Onboarding, UserProfile } from "@/components/Onboarding";
import { Login } from "@/components/Login";

const STORAGE_KEY = "playlog_user";

function loadStored(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function saveStored(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
}

// Inner component so we can conditionally run the verification query.
// Verifies the stored token is still valid by calling /api/auth/me — if the
// server rejects it (token revoked, secret rotated), we drop back to login.
function VerifiedApp({ stored, onInvalid }: { stored: UserProfile; onInvalid: () => void }) {
  const result = useQuery(api.auth.me, {});

  useEffect(() => {
    if (result === null) {
      onInvalid();
    }
  }, [result, onInvalid]);

  if (result === undefined) return null; // loading
  if (result === null) return null;      // about to redirect

  // Reconcile any stale fields the verified server response disagrees with.
  const reconciled: UserProfile = {
    ...stored,
    userId: result._id as Id<"users">,
    name: result.name,
    email: result.email,
  };
  return <AppLayout user={reconciled} />;
}

type AuthScreen = "login" | "signup";

const Index = () => {
  const [user, setUser] = useState<UserProfile | null>(loadStored);
  const [screen, setScreen] = useState<AuthScreen>(() =>
    // First-time visitors land on signup; returning visitors who got logged
    // out (token expired) land on login.
    getAuthToken() && !loadStored() ? "login" : "signup"
  );

  useEffect(() => {
    return onUnauthorized(() => {
      clearStored();
      setAuthToken(null);
      setUser(null);
      setScreen("login");
    });
  }, []);

  const handleComplete = (profile: UserProfile) => {
    saveStored(profile);
    setUser(profile);
  };

  const handleInvalid = () => {
    clearStored();
    setAuthToken(null);
    setUser(null);
    setScreen("login");
  };

  if (!user) {
    return screen === "login" ? (
      <Login
        onComplete={handleComplete}
        onSwitchToSignup={() => setScreen("signup")}
      />
    ) : (
      <Onboarding
        onComplete={handleComplete}
        onSwitchToLogin={() => setScreen("login")}
      />
    );
  }

  return <VerifiedApp stored={user} onInvalid={handleInvalid} />;
};

export default Index;
