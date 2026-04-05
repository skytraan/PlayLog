import { mockPlayerCards } from "@/data/mockData";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";
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
    streak: mock?.streak ?? 0,
    badges: mock?.badges ?? [],
    activeChallenge: mock?.activeChallenge ?? null,
    challengeSetDate: mock?.challengeSetDate ?? null,
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
      <FifaPlayerCard name={userName} ratings={fifaRatings} />
      <PlayerCardComponent card={card} />
      {card.activeChallenge && (
        <ActiveChallenge
          challenge={card.activeChallenge}
          setDate={card.challengeSetDate}
        />
      )}
      <BadgeGrid badges={card.badges} />
    </div>
  );
}
