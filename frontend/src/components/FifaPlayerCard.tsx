interface TennisRatings {
  serve: number | null;
  forehand: number | null;
  backhand: number | null;
  volley: number | null;
  footwork: number | null;
}

interface FifaPlayerCardProps {
  name: string;
  photoUrl?: string;
  ratings: TennisRatings;
}

type CardTier = "bronze" | "silver" | "gold" | "diamond";

function getTier(ovr: number): CardTier {
  if (ovr >= 90) return "diamond";
  if (ovr >= 75) return "gold";
  if (ovr >= 50) return "silver";
  return "bronze";
}

const tierStyles: Record<CardTier, { bg: string; shadow: string; border: string; textColor: string; labelColor: string; dividerColor: string; avatarBorder: string }> = {
  bronze: {
    bg: "linear-gradient(160deg, #a0673a 0%, #cd9b6e 25%, #b8723f 55%, #8b4e22 80%, #6b3518 100%)",
    shadow: "0 8px 32px rgba(120,60,0,0.45), inset 0 1px 0 rgba(255,200,150,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
    border: "rgba(205,155,100,0.6)",
    textColor: "#1a0800",
    labelColor: "#5a2a00",
    dividerColor: "rgba(100,50,0,0.3)",
    avatarBorder: "rgba(205,155,100,0.7)",
  },
  silver: {
    bg: "linear-gradient(160deg, #8a9aaa 0%, #c8d8e8 25%, #a0b4c8 55%, #788898 80%, #586878 100%)",
    shadow: "0 8px 32px rgba(80,100,120,0.45), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.15)",
    border: "rgba(200,220,240,0.7)",
    textColor: "#0a1020",
    labelColor: "#304050",
    dividerColor: "rgba(80,100,120,0.3)",
    avatarBorder: "rgba(200,220,240,0.8)",
  },
  gold: {
    bg: "linear-gradient(160deg, #f0c040 0%, #f7df82 25%, #e8b830 55%, #c8920a 80%, #a07010 100%)",
    shadow: "0 8px 32px rgba(180,120,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
    border: "rgba(255,220,80,0.6)",
    textColor: "#1a0800",
    labelColor: "#5a3a00",
    dividerColor: "rgba(120,70,0,0.3)",
    avatarBorder: "rgba(255,220,80,0.7)",
  },
  diamond: {
    bg: "linear-gradient(160deg, #60d0f0 0%, #a8eeff 25%, #70d8ff 55%, #30b8e8 80%, #1090c0 100%)",
    shadow: "0 8px 32px rgba(0,150,200,0.5), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.1)",
    border: "rgba(160,240,255,0.8)",
    textColor: "#001830",
    labelColor: "#004060",
    dividerColor: "rgba(0,120,160,0.3)",
    avatarBorder: "rgba(160,240,255,0.9)",
  },
};

function calcOverall(r: TennisRatings): number | null {
  const entries: Array<[number | null, number]> = [
    [r.serve, 0.25],
    [r.forehand, 0.25],
    [r.backhand, 0.20],
    [r.footwork, 0.15],
    [r.volley, 0.15],
  ];
  const tracked = entries.filter(([v]) => v != null) as Array<[number, number]>;
  if (tracked.length === 0) return null;
  const totalWeight = tracked.reduce((s, [, w]) => s + w, 0);
  return Math.round(tracked.reduce((s, [v, w]) => s + v * w, 0) / totalWeight);
}


export function FifaPlayerCard({ name, photoUrl, ratings }: FifaPlayerCardProps) {
  const overall = calcOverall(ratings);
  const tier = getTier(overall ?? 0);
  const s = tierStyles[tier];

  const stat = (label: string, value: number | null) => (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold leading-none" style={{ color: s.textColor, minWidth: "2ch", textAlign: "right" }}>
        {value ?? "—"}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: s.labelColor, opacity: 0.85 }}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex justify-center py-4">
      <div
        className="relative select-none transition-transform hover:scale-[1.02]"
        style={{
          width: 230,
          aspectRatio: "2 / 3",
          borderRadius: 14,
          background: s.bg,
          boxShadow: s.shadow,
          padding: 1,
        }}
      >
        {/* Inner card border */}
        <div
          className="absolute inset-[6px] rounded-[10px] pointer-events-none"
          style={{ border: `1px solid ${s.border}` }}
        />

        <div className="flex flex-col h-full px-4 pt-3 pb-3">
          {/* Top row: OVR + tier */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center leading-none">
              <span className="text-4xl font-black" style={{ color: s.textColor, textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                {overall ?? "—"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: s.labelColor }}>
                OVR
              </span>
              <span className="text-base mt-1">🎾</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.labelColor }}>{tier}</span>
          </div>

          {/* Player photo */}
          <div className="flex-1 flex items-center justify-center py-2">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="rounded-full object-cover"
                style={{ width: 90, height: 90, border: `2px solid ${s.avatarBorder}`, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full text-5xl"
                style={{ width: 90, height: 90, background: "rgba(0,0,0,0.12)", border: `2px solid ${s.avatarBorder}`, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}
              >
                👤
              </div>
            )}
          </div>

          {/* Player name */}
          <div className="text-center mb-3">
            <span className="text-sm font-black uppercase tracking-widest" style={{ color: s.textColor, letterSpacing: "0.12em" }}>
              {(name.split(" ")[0] ?? name).toUpperCase()}
            </span>
          </div>

          {/* Divider */}
          <div className="mb-2.5" style={{ borderTop: `1px solid ${s.dividerColor}` }} />

          {/* Stats: two columns */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pb-1">
            {stat("SRV", ratings.serve)}
            {stat("FH", ratings.forehand)}
            {stat("BH", ratings.backhand)}
            {stat("VLY", ratings.volley)}
            {stat("FTW", ratings.footwork)}
          </div>
        </div>
      </div>
    </div>
  );
}
