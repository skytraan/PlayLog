import { mockPlayerCards } from "@/data/mockData";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";
import { OvrGoal } from "@/components/OvrGoal";
import { ProgressTimeline } from "@/components/ProgressTimeline";
import { TENNIS_SKILLS } from "@/types/playlog";

interface ProgressProps {
  profileId: string;
  userName: string;
}

const defaultRatings = TENNIS_SKILLS.map((name) => ({
  name,
  score: 0,
  justification: "",
  topWeakness: "",
  topStrength: "",
}));

export function Progress({ profileId, userName }: ProgressProps) {
  const mock = mockPlayerCards[profileId];

  const card = {
    profileId,
    playerName: userName,
    sport: "tennis" as const,
    overallRating: 0,
    ratings: defaultRatings,
    level: "Beginner",
    streak: 0,
    badges: [],
    activeChallenge: null,
    challengeSetDate: null,
    totalSessions: 0,
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
