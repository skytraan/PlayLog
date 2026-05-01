import { api, useQuery, type Id } from "@/lib/api";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";
import { OvrGoal } from "@/components/OvrGoal";
import { ProgressTimeline } from "@/components/ProgressTimeline";
import { TENNIS_SKILLS, getLevelTitle } from "@/types/playlog";

interface ProgressProps {
  userId: Id<"users">;
  userName: string;
}


export function Progress({ userId, userName }: ProgressProps) {
  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });
  const sessions = rawSessions ?? [];
  const totalSessions = sessions.length;

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

  return (
    <div className="space-y-6">
      {/* Top row: FIFA card + OVR goal */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-full sm:w-auto">
          <FifaPlayerCard name={userName} ratings={fifaRatings} />
        </div>
        <div className="flex-1">
          <OvrGoal userId={userId} currentOvr={card.overallRating} />
        </div>
      </div>

      {/* Main row: player card left, timeline right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PlayerCardComponent card={card} />
        <ProgressTimeline data={
          [...sessions].reverse().map((s, i) => ({
            date: `Session ${i + 1}`,
            ovr: s.overallScore ?? 0,
          }))
        } />
      </div>

      {card.activeChallenge && (
        <ActiveChallenge
          challenge={card.activeChallenge}
          setDate={card.challengeSetDate}
        />
      )}
      <BadgeGrid earnedBadges={earnedBadges} />
    </div>
  );
}
