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

  const card = {
    profileId: userId,
    playerName: userName,
    sport: "tennis" as const,
    overallRating: 0,
    ratings: defaultRatings,
    level: getLevelTitle(0),
    streak: 0,
    badges: [],
    activeChallenge: null,
    challengeSetDate: null,
    totalSessions,
  };

  const fifaRatings = {
    serve: 0,
    forehand: 0,
    backhand: 0,
    volley: 0,
    footwork: 0,
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
        <ProgressTimeline data={[]} />
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
