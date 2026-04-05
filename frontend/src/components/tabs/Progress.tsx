import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

const defaultRatings = TENNIS_SKILLS.map((name) => ({
  name,
  score: 0,
  justification: "",
  topWeakness: "",
  topStrength: "",
}));

export function Progress({ userId, userName }: ProgressProps) {
  const rawSessions = useQuery(api.sessions.listSessionsWithFeedback, { userId });
  const sessions = rawSessions ?? [];
  const totalSessions = sessions.length;

  // Derive per-skill ratings from feedback across all sessions.
  // Skills mentioned in strengths score higher; in improvements score lower.
  const SKILL_KEYS: (keyof typeof fifaRatings)[] = ["serve", "forehand", "backhand", "volley", "footwork"];
  const SKILL_ALIASES: Record<keyof typeof fifaRatings, string[]> = {
    serve:     ["serve", "srv"],
    forehand:  ["forehand", "fh"],
    backhand:  ["backhand", "bh"],
    volley:    ["volley", "vly", "net"],
    footwork:  ["footwork", "ftw", "movement", "footspeed"],
  };

  const fifaRatings = { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };

  if (sessions.length > 0) {
    // Accumulate strength/improvement hits across sessions
    const strengthHits: Record<string, number> = { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };
    const improvHits: Record<string, number>   = { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };

    for (const { feedback } of sessions) {
      if (!feedback) continue;
      for (const skill of SKILL_KEYS) {
        const aliases = SKILL_ALIASES[skill];
        const inStrength = feedback.strengths.some((s) =>
          aliases.some((a) => s.toLowerCase().includes(a))
        );
        const inImprovement = feedback.improvements.some((s) =>
          aliases.some((a) => s.toLowerCase().includes(a))
        );
        if (inStrength) strengthHits[skill]++;
        if (inImprovement) improvHits[skill]++;
      }
    }

    for (const skill of SKILL_KEYS) {
      const s = strengthHits[skill];
      const i = improvHits[skill];
      const total = s + i;
      if (total === 0) {
        fifaRatings[skill] = 50; // neutral if never mentioned
      } else {
        // Scale: all strengths → ~85, all improvements → ~40
        fifaRatings[skill] = Math.round(40 + (s / total) * 45);
      }
    }
  }

  // Use the most recent MediaPipe overallScore as the OVR; fall back to
  // the feedback-derived weighted average if no pose score exists yet.
  const latestPoseScore = sessions.find((s) => s.overallScore != null)?.overallScore ?? null;
  const overallRating = sessions.length === 0
    ? 0
    : latestPoseScore ?? Math.round(
        fifaRatings.serve * 0.25 +
        fifaRatings.forehand * 0.25 +
        fifaRatings.backhand * 0.20 +
        fifaRatings.footwork * 0.15 +
        fifaRatings.volley * 0.15
      );

  const card = {
    profileId: userId,
    playerName: userName,
    sport: "tennis" as const,
    overallRating,
    ratings: defaultRatings,
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
          <OvrGoal currentOvr={card.overallRating} />
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
      <BadgeGrid earnedBadges={card.badges} />
    </div>
  );
}
