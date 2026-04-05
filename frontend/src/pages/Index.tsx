import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import AppLayout from "@/components/AppLayout";
import { Onboarding, UserProfile } from "@/components/Onboarding";

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

// Inner component so we can conditionally run the verification query
function VerifiedApp({ stored, onInvalid }: { stored: UserProfile; onInvalid: () => void }) {
  const result = useQuery(api.users.findUser, { userId: stored.userId as Id<"users"> });

  useEffect(() => {
    // result === null means query ran and user doesn't exist — clear and re-onboard
    // result === undefined means still loading — don't act yet
    if (result === null) {
      clearStored();
      onInvalid();
    }
  }, [result, onInvalid]);

  if (result === undefined) return null; // loading
  if (result === null) return null;      // about to redirect

  return <AppLayout user={stored} />;
}

const Index = () => {
  const [user, setUser] = useState<UserProfile | null>(loadStored);

  const handleComplete = (profile: UserProfile) => {
    saveStored(profile);
    setUser(profile);
  };

  if (!user) {
    return <Onboarding onComplete={handleComplete} />;
  }

  return <VerifiedApp stored={user} onInvalid={() => setUser(null)} />;
};

export default Index;
