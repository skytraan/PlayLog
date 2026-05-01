import { api, useQuery, type Id } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";
import { OvrGoal } from "@/components/OvrGoal";
import { ProgressTimeline } from "@/components/ProgressTimeline";
import { TENNIS_SKILLS, getLevelTitle } from "@/types/playlog";
import { ALL_TENNIS_BADGES } from "@/data/mockData";

const INITIAL_OVR: Record<string, number> = {
  beginner: 30,
  developing: 50,
  proficient: 70,
  elite: 85,
};

interface ProgressProps {
  userId: Id<"users">;
  userName: string;
  initialLevel?: string;
}


export function Progress({ userId, userName, initialLevel }: ProgressProps) {
  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });

  if (rawSessions === undefined) return <ProgressSkeleton />;

  const sessions = rawSessions;
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    const ovr = initialLevel ? (INITIAL_OVR[initialLevel] ?? 0) : 0;
    const placeholderRatings = { serve: ovr || null, forehand: ovr || null, backhand: ovr || null, volley: ovr || null, footwork: ovr || null };
    return <ProgressPlaceholder userId={userId} userName={userName} ovr={ovr} ratings={placeholderRatings} />;
  }

  const earnedBadges = (useQuery(api.badges.getUserBadges, { userId }) ?? []).map((b) => ({
    id: b.badgeId,
    name: b.badgeId,
    description: "",
    icon: "",
    earnedDate: new Date(b.earnedAt).toISOString(),
  }));

  // Map MediaPipe technique names to rating keys
  const TECHNIQUE_TO_KEY: Record<string, keyof typeof fifaRatings> = {
    serve:                "serve",
    forehand:             "forehand",
    backhand_one_handed:  "backhand",
    volley:               "volley",
    footwork:             "footwork",
  };

  type RatingKey = "serve" | "forehand" | "backhand" | "volley" | "footwork";
  const scoreSums: Record<RatingKey, number>  = { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };
  const scoreCounts: Record<RatingKey, number> = { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };

  for (const { poseAnalysis } of sessions) {
    if (!poseAnalysis) continue;
    try {
      const parsed = JSON.parse(poseAnalysis);
      const results: Array<{ technique: string; overallScore: number }> = Array.isArray(parsed) ? parsed : [parsed];
      for (const r of results) {
        const key = TECHNIQUE_TO_KEY[r.technique];
        if (!key || r.overallScore == null) continue;
        scoreSums[key] += r.overallScore;
        scoreCounts[key]++;
      }
    } catch {
      // malformed poseAnalysis — skip
    }
  }

  const fifaRatings: Record<RatingKey, number | null> = {
    serve:     scoreCounts.serve     > 0 ? Math.round(scoreSums.serve     / scoreCounts.serve)     : null,
    forehand:  scoreCounts.forehand  > 0 ? Math.round(scoreSums.forehand  / scoreCounts.forehand)  : null,
    backhand:  scoreCounts.backhand  > 0 ? Math.round(scoreSums.backhand  / scoreCounts.backhand)  : null,
    volley:    scoreCounts.volley    > 0 ? Math.round(scoreSums.volley    / scoreCounts.volley)    : null,
    footwork:  scoreCounts.footwork  > 0 ? Math.round(scoreSums.footwork  / scoreCounts.footwork)  : null,
  };

  // OVR = weighted average of only the skills that have been tracked
  const OVR_WEIGHTS: Record<RatingKey, number> = { serve: 0.25, forehand: 0.25, backhand: 0.20, footwork: 0.15, volley: 0.15 };
  const trackedEntries = (Object.keys(fifaRatings) as RatingKey[]).filter((k) => fifaRatings[k] != null);
  const totalWeight = trackedEntries.reduce((s, k) => s + OVR_WEIGHTS[k], 0);
  const overallRating = trackedEntries.length === 0
    ? 0
    : Math.round(trackedEntries.reduce((s, k) => s + (fifaRatings[k] as number) * OVR_WEIGHTS[k], 0) / totalWeight);

  const skillRatings = TENNIS_SKILLS.map((name) => ({
    name,
    score: fifaRatings[name.toLowerCase() as RatingKey] ?? 0,
    justification: "",
    topWeakness: "",
    topStrength: "",
  }));

  const card = {
    profileId: userId,
    playerName: userName,
    sport: "tennis" as const,
    overallRating,
    ratings: skillRatings,
    level: getLevelTitle(overallRating),
    streak: 0,
    badges: [],
    activeChallenge: null,
    challengeSetDate: null,
    totalSessions,
  };

  const timelineData = [...sessions]
    .reverse()
    .map((s, i) => ({ date: `S${i + 1}`, ovr: s.overallScore ?? 0 }));

  const delta =
    timelineData.length >= 2
      ? `+${timelineData[timelineData.length - 1].ovr - timelineData[0].ovr}`
      : undefined;

  return (
    <div className="space-y-6">
      {/* Top row: FIFA card (gradient container) + OVR goal */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-stretch">
        <div
          className="border border-border rounded-2xl p-4 flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at top, hsl(153 60% 12%), hsl(222 20% 8%) 65%)" }}
        >
          <FifaPlayerCard name={userName} ratings={fifaRatings} />
        </div>
        <div className="flex-1">
          <OvrGoal
            userId={userId}
            currentOvr={card.overallRating}
            totalSessions={totalSessions}
            streak={0}
            earnedBadgesCount={earnedBadges.length}
            totalBadges={ALL_TENNIS_BADGES.length}
          />
        </div>
      </div>

      {/* Challenge banner — always visible */}
      <ActiveChallenge
        challenge={card.activeChallenge ?? "Upload your first session and get a complete skill breakdown from your AI coach"}
        setDate={card.challengeSetDate}
      />

      {/* Timeline + player card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ProgressTimeline data={timelineData} delta={delta} />
        <PlayerCardComponent card={card} />
      </div>

      <BadgeGrid earnedBadges={earnedBadges} />
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-6">
        <Skeleton className="h-48 w-full sm:w-48 rounded-xl" />
        <Skeleton className="h-48 flex-1 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function ProgressPlaceholder({
  userId,
  userName,
  ovr,
  ratings,
}: {
  userId: Id<"users">;
  userName: string;
  ovr: number;
  ratings: { serve: number | null; forehand: number | null; backhand: number | null; volley: number | null; footwork: number | null };
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-stretch">
        <div
          className="border border-border rounded-2xl p-4 flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at top, hsl(153 60% 12%), hsl(222 20% 8%) 65%)" }}
        >
          <FifaPlayerCard name={userName} ratings={ratings} />
        </div>
        <div className="flex-1">
          <OvrGoal
            userId={userId}
            currentOvr={ovr}
            totalSessions={0}
            streak={0}
            earnedBadgesCount={0}
            totalBadges={ALL_TENNIS_BADGES.length}
          />
        </div>
      </div>
      <ActiveChallenge
        challenge="Upload your first session and get a complete skill breakdown from your AI coach"
        setDate={null}
      />
      <div className="border border-border rounded-2xl px-5 py-8 text-center space-y-1.5">
        <p className="text-sm font-medium text-foreground">These are your starting stats</p>
        <p className="text-xs text-muted-foreground">
          Upload a video on the Learn tab — your first session will replace these with real scores.
        </p>
      </div>
    </div>
  );
}
