import { Profile } from "@/types/playlog";

interface ProfileSwitcherProps {
  profiles: Profile[];
  activeProfile: Profile;
  onSwitch: (profile: Profile) => void;
}

const sportIcons: Record<string, string> = {
  tennis: "🎾",
  golf: "⛳",
};

export function ProfileSwitcher({ profiles, activeProfile, onSwitch }: ProfileSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => onSwitch(profile)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeProfile.id === profile.id
              ? "bg-foreground text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <span className="text-sm">{sportIcons[profile.sport]}</span>
          <span>{profile.name}</span>
        </button>
      ))}
    </div>
  );
}
