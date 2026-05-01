import { useState } from "react";
import { api, useMutation, type Id } from "@/lib/api";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";

export interface UserProfile {
  userId: Id<"users">;
  name: string;
  email: string;
  sport: "tennis";
  level?: string;
}

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SPORTS = [
  { id: "tennis",     label: "Tennis",     icon: "🎾", available: true,  desc: "Serve, forehand, backhand, footwork — the lot." },
  { id: "golf",       label: "Golf",       icon: "⛳", available: false, desc: "Driving, irons, short game. Coming soon." },
  { id: "basketball", label: "Basketball", icon: "🏀", available: false, desc: "Shooting form & footwork. Coming soon." },
];

const LEVELS = [
  { id: "beginner",   label: "Just picked it up", desc: "Less than a year of regular play",        ovr: "~30", ovrNum: 30 },
  { id: "developing", label: "Recreational",       desc: "Play casually most weeks",               ovr: "~50", ovrNum: 50 },
  { id: "proficient", label: "Club player",        desc: "Competitive in club leagues or ladders", ovr: "~70", ovrNum: 70 },
  { id: "elite",      label: "Tournament player",  desc: "Compete at sectional level or higher",   ovr: "~85", ovrNum: 85 },
];

const LEVEL_OVR: Record<string, number> = Object.fromEntries(LEVELS.map((l) => [l.id, l.ovrNum]));

// ── Shared sub-components ─────────────────────────────────────────────────────

function StepHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-7">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">{eyebrow}</p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mt-7">
      {onBack && (
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
        >
          Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <StepHeader
        eyebrow="Welcome"
        title="Your AI tennis coach is here."
        subtitle="Upload footage. Get structured feedback. Watch your rating climb."
      />
      <div className="space-y-3 mt-6">
        {[
          { icon: "📹", title: "AI video analysis",     desc: "Per-stroke breakdown of your form, timing, and footwork." },
          { icon: "📊", title: "Skill ratings 0–100",   desc: "FIFA-style scores so you know exactly where you stand." },
          { icon: "🎯", title: "Personal challenges",   desc: "A targeted goal for every next session — small wins, week over week." },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-card border border-border">
            <span className="text-xl mt-0.5">{f.icon}</span>
            <div>
              <div className="text-sm font-semibold text-foreground">{f.title}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <NavButtons onNext={onNext} nextLabel="Get started" />
      <p className="mt-4 text-[11px] text-muted-foreground text-center">Free to try · Takes about a minute</p>
    </div>
  );
}

interface StepData {
  name: string;
  email: string;
  sport: string;
  level: string | null;
}

function StepProfile({
  data,
  setData,
  errors,
  onNext,
  onBack,
}: {
  data: StepData;
  setData: React.Dispatch<React.SetStateAction<StepData>>;
  errors: Record<string, string>;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Step 1 of 3"
        title="Create your profile"
        subtitle="So we can save your sessions and track progress over time."
      />
      <div className="space-y-4">
        <Field label="Full name" error={errors.name}>
          <input
            value={data.name}
            onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
            placeholder="Alex Chen"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={data.email}
            onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
            placeholder="alex@playlog.app"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          />
        </Field>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

function StepSport({
  data,
  setData,
  onNext,
  onBack,
}: {
  data: StepData;
  setData: React.Dispatch<React.SetStateAction<StepData>>;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Step 2 of 3"
        title="Pick your sport"
        subtitle="More sports are on the way — for now we're best at tennis."
      />
      <div className="space-y-2.5">
        {SPORTS.map((s) => {
          const selected = data.sport === s.id;
          return (
            <button
              key={s.id}
              onClick={() => s.available && setData((d) => ({ ...d, sport: s.id }))}
              disabled={!s.available}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all ${
                selected
                  ? "border-primary/60 bg-primary/5"
                  : s.available
                  ? "border-border bg-card hover:border-foreground/30"
                  : "border-border/50 bg-card/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{s.label}</span>
                  {!s.available && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  selected ? "border-primary bg-primary" : "border-border"
                }`}
              >
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
}

function StepLevel({
  data,
  setData,
  onNext,
  onBack,
  submitting,
  submitError,
}: {
  data: StepData;
  setData: React.Dispatch<React.SetStateAction<StepData>>;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
  submitError?: string;
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Step 3 of 3"
        title="Where are you today?"
        subtitle="Your starting OVR. We'll calibrate against your first uploaded session."
      />
      <div className="space-y-2.5">
        {LEVELS.map((l) => {
          const selected = data.level === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setData((d) => ({ ...d, level: l.id }))}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-all ${
                selected ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{l.label}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{l.desc}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-base font-mono font-bold text-foreground">{l.ovr}</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">OVR</div>
              </div>
            </button>
          );
        })}
      </div>
      {submitError && <p className="mt-3 text-xs text-destructive">{submitError}</p>}
      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!data.level || submitting}
        nextLabel={submitting ? "Creating your profile…" : "Create my profile →"}
      />
    </div>
  );
}

// ── Right branding panel ──────────────────────────────────────────────────────

function BrandPanel({ data }: { data: StepData }) {
  const ovr = data.level ? (LEVEL_OVR[data.level] ?? 50) : 50;
  const ratings = { serve: ovr, forehand: ovr, backhand: ovr, volley: ovr, footwork: ovr };

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="text-3xl font-black text-foreground tracking-tight">
          Built for the<br />weekly grinder.
        </div>
        <p className="mt-3 text-sm text-muted-foreground max-w-sm leading-relaxed">
          One short clip a week. Honest feedback. A tangible rating that goes up.
        </p>
        <div className="mt-10">
          <FifaPlayerCard
            name={data.name || "Alex Chen"}
            ratings={ratings}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Powered by TwelveLabs · Gemini · MediaPipe</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>({ name: "", email: "", sport: "tennis", level: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const createUser = useMutation(api.users.createUser);

  // ── Steps: 0=Welcome, 1=Profile, 2=Sport, 3=Level ──
  const TOTAL_STEPS = 3; // non-welcome steps

  const validateProfile = (): boolean => {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) {
      errs.name = "Full name is required";
    } else if (data.name.trim().split(/\s+/).length < 2) {
      errs.name = "Please enter your first and last name";
    }
    if (!data.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errs.email = "Enter a valid email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = async () => {
    if (step === 1 && !validateProfile()) return;
    if (step === 3) {
      // Final step — submit
      setSubmitError(undefined);
      setSubmitting(true);
      try {
        const userId = await createUser({
          name: data.name.trim(),
          email: data.email.trim(),
          sports: ["tennis"],
        });
        onComplete({ userId, name: data.name.trim(), email: data.email.trim(), sport: "tennis", level: data.level ?? undefined });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to create account. Please try again.");
        setSubmitting(false);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <div className="px-8 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <img src="/logo.png" alt="PlayLog" className="h-10 w-auto" />
        {step > 0 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i + 1 < step
                    ? "w-2 h-2 bg-primary"
                    : i + 1 === step
                    ? "w-6 h-2 bg-primary"
                    : "w-2 h-2 bg-border"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left — step content */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            {step === 0 && <StepWelcome onNext={next} />}
            {step === 1 && (
              <StepProfile data={data} setData={setData} errors={errors} onNext={next} onBack={back} />
            )}
            {step === 2 && (
              <StepSport data={data} setData={setData} onNext={next} onBack={back} />
            )}
            {step === 3 && (
              <StepLevel
                data={data}
                setData={setData}
                onNext={next}
                onBack={back}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>
        </div>

        {/* Right — branding panel */}
        <div
          className="hidden lg:flex flex-1 flex-col border-l border-border px-12 py-12 relative overflow-hidden"
          style={{ background: "radial-gradient(ellipse at top right, hsl(153 50% 14%) 0%, hsl(222 18% 11%) 60%)" }}
        >
          <BrandPanel data={data} />
        </div>
      </div>
    </div>
  );
}
