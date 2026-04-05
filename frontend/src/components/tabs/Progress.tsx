import { mockPlayerCards } from "@/data/mockData";
import { PlayerCardComponent } from "@/components/PlayerCard";
import { BadgeGrid } from "@/components/BadgeGrid";
import { ActiveChallenge } from "@/components/ActiveChallenge";
import { FifaPlayerCard } from "@/components/FifaPlayerCard";

interface ProgressProps {
  profileId: string;
  userName: string;
}

export function Progress({ profileId, userName }: ProgressProps) {
  const card = mockPlayerCards[profileId];

  // Derive tennis skill ratings from the existing card data if available
  const ratings = card
    ? {
        serve: card.ratings.find((r) => r.name === "Serve")?.score ?? 0,
        forehand: card.ratings.find((r) => r.name === "Forehand")?.score ?? 0,
        backhand: card.ratings.find((r) => r.name === "Backhand")?.score ?? 0,
        volley: card.ratings.find((r) => r.name === "Net Play")?.score ?? 0,
        footwork: card.ratings.find((r) => r.name === "Footwork")?.score ?? 0,
      }
    : { serve: 0, forehand: 0, backhand: 0, volley: 0, footwork: 0 };

  return (
    <div className="space-y-6">
      <FifaPlayerCard name={userName} ratings={ratings} />

      {card ? (
        <>
          <PlayerCardComponent card={card} />
          {card.activeChallenge && (
            <ActiveChallenge
              challenge={card.activeChallenge}
              setDate={card.challengeSetDate}
            />
          )}
          <BadgeGrid badges={card.badges} />
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No progress data yet. Upload a session in the Learn tab to get started.
        </div>
      )}
    </div>
  );
}
