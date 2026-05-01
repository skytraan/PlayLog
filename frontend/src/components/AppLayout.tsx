import { useState } from "react";
import { Learn } from "@/components/tabs/Learn";
import { Progress } from "@/components/tabs/Progress";
import { UserProfile } from "@/components/Onboarding";

interface AppLayoutProps {
  user: UserProfile;
}

export default function AppLayout({ user }: AppLayoutProps) {
  const [activeTab, setActiveTab] = useState<"learn" | "progress">("learn");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-7">
              <img src="/logo.png" alt="PlayLog" className="h-11 w-auto" />
              <nav className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1">
                {[
                  { id: "learn", label: "Learn", icon: "📹" },
                  { id: "progress", label: "Progress", icon: "📈" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as "learn" | "progress")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      activeTab === t.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-xs">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-secondary border border-border text-foreground/80">
                <span>🔥</span>
                <span className="font-mono">4 wk streak</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen((p) => !p)}
                  className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                >
                  <div
                    className="flex items-center justify-center rounded-full bg-secondary text-foreground font-medium border border-border text-xs"
                    style={{ width: 28, height: 28 }}
                  >
                    {initials || "👤"}
                  </div>
                  <span className="text-sm text-foreground hidden sm:inline">{user.name}</span>
                  <span className="text-muted-foreground text-xs">▾</span>
                </button>

                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-2xl z-40 overflow-hidden">
                      <div className="px-3 py-3 border-b border-border">
                        <div className="text-sm font-semibold text-foreground">{user.name}</div>
                        <div className="text-[11px] text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="py-1">
                        {["My profile", "Settings", "Sign out"].map((item) => (
                          <button
                            key={item}
                            className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-secondary transition-colors"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 pb-24">
        {activeTab === "learn" ? (
          <Learn sport={user.sport} userId={user.userId} />
        ) : (
          <Progress userId={user.userId} userName={user.name} initialLevel={user.level} />
        )}
      </main>
    </div>
  );
}
