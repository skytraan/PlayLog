import { useState } from "react";
import { Profile } from "@/types/playlog";
import { mockProfiles } from "@/data/mockData";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { Learn } from "@/components/tabs/Learn";
import { Progress } from "@/components/tabs/Progress";

export default function AppLayout() {
  const [activeProfile, setActiveProfile] = useState<Profile>(mockProfiles[0]);
  const [activeTab, setActiveTab] = useState<"learn" | "progress">("learn");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-base font-semibold tracking-tight text-foreground">
                Playlog
              </span>
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab("learn")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "learn"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Learn
                </button>
                <button
                  onClick={() => setActiveTab("progress")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "progress"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Progress
                </button>
              </nav>
            </div>
            <ProfileSwitcher
              profiles={mockProfiles}
              activeProfile={activeProfile}
              onSwitch={setActiveProfile}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        {activeTab === "learn" ? (
          <Learn profileId={activeProfile.id} sport={activeProfile.sport} />
        ) : (
          <Progress profileId={activeProfile.id} />
        )}
      </main>
    </div>
  );
}
