import { useState } from "react";
import { Learn } from "@/components/tabs/Learn";
import { Progress } from "@/components/tabs/Progress";
import { UserProfile } from "@/components/Onboarding";
import { setAuthToken } from "@/lib/api";

interface AppLayoutProps {
  user: UserProfile;
}

const STORAGE_KEY = "playlog_user";

function handleSignOut() {
  setAuthToken(null);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.location.reload();
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
          <div className="flex h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-7 min-w-0">
              <img src="/logo.png" alt="PlayLog" className="h-9 sm:h-11 w-auto flex-shrink-0" />
              {/* Tap targets bumped to 44px tall on mobile per Apple HIG /
                  WCAG. Labels stay visible at 375px because the streak chip
                  and the user name both hide on small screens. */}
              <nav className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1">
                {[
                  { id: "learn", label: "Learn", icon: "📹" },
                  { id: "progress", label: "Progress", icon: "📈" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as "learn" | "progress")}
                    className={`px-3 py-2 sm:py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 min-h-[40px] sm:min-h-0 ${
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
                        {(["My profile", "Settings", "Sign out"] as const).map((item) => (
                          <button
                            key={item}
                            onClick={() => {
                              setProfileMenuOpen(false);
                              if (item === "Sign out") handleSignOut();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors min-h-[40px]"
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
