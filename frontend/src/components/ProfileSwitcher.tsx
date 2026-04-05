import { ChevronDown } from "lucide-react";
import { Profile } from "@/types/playlog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfileSwitcherProps {
  profiles: Profile[];
  activeProfile: Profile;
  onSwitch: (profile: Profile) => void;
}

const sportIcons: Record<string, string> = {
  tennis: "🎾",
  golf: "⛳",
  basketball: "🏀",
};

const comingSoonSports = ["golf", "basketball"];

export function ProfileSwitcher({ profiles, activeProfile, onSwitch }: ProfileSwitcherProps) {
  const allOptions = [
    ...profiles,
    { id: "basketball-1", sport: "basketball", name: "Basketball" } as Profile,
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-foreground text-primary-foreground transition-colors hover:opacity-90 whitespace-nowrap">
        <span>{sportIcons[activeProfile.sport]}</span>
        <span>{activeProfile.name}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {allOptions.map((profile) => {
          const isDisabled = comingSoonSports.includes(profile.sport);
          return (
            <DropdownMenuItem
              key={profile.id}
              disabled={isDisabled}
              onClick={() => !isDisabled && onSwitch(profile)}
              className={isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
            >
              <span className="mr-2">{sportIcons[profile.sport]}</span>
              <span>{profile.name}</span>
              {isDisabled && (
                <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
