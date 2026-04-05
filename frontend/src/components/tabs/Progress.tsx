import { mockPlayerCards } from "@/data/mockData";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";

interface ProgressProps {
  profileId: string;
}

export function Progress({ profileId }: ProgressProps) {
  const card = mockPlayerCards[profileId];

  if (!card) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No progress data yet. Upload a session in the Learn tab to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
