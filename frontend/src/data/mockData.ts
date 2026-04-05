import { Profile, Session, PlayerCard, Badge, ChatMessage } from "@/types/playlog";

export const ALL_TENNIS_BADGES: Badge[] = [
  { id: "ace-machine",   name: "Ace Machine",   description: "Serve rating above 75",                          icon: "🎯", earnedDate: null },
  { id: "net-ninja",     name: "Net Ninja",      description: "Volley rating improves by 15+ points",           icon: "🥷", earnedDate: null },
  { id: "hot-streak",    name: "Hot Streak",     description: "4 consecutive weeks with a session uploaded",    icon: "🔥", earnedDate: null },
  { id: "most-improved", name: "Most Improved",  description: "Overall rating increases by 10+ in one month",  icon: "📈", earnedDate: null },
  { id: "comeback-kid",  name: "Comeback Kid",   description: "Improve OVR after two sessions of decline",     icon: "💪", earnedDate: null },
  { id: "sharp-shooter", name: "Sharp Shooter",  description: "Forehand rating above 80",                      icon: "🏹", earnedDate: null },
  { id: "iron-wall",     name: "Iron Wall",       description: "Backhand rating above 80",                      icon: "🛡️", earnedDate: null },
  { id: "speed-demon",   name: "Speed Demon",    description: "Footwork rating above 80",                      icon: "⚡", earnedDate: null },
];

export const mockProfiles: Profile[] = [
  { id: "tennis-1", sport: "tennis", name: "Tennis" },
  { id: "golf-1", sport: "golf", name: "Golf" },
];

const tennisBadges: Badge[] = [
  { id: "ace-machine", name: "Ace Machine", description: "Serve consistency above 75", icon: "🎯", earnedDate: "2026-03-15" },
  { id: "net-ninja", name: "Net Ninja", description: "Net play rating improves by 15+ points", icon: "🥷", earnedDate: null },
  { id: "hot-streak", name: "Hot Streak", description: "4-week consecutive session streak", icon: "🔥", earnedDate: "2026-03-28" },
  { id: "most-improved", name: "Most Improved", description: "Overall rating increases by 10+ in one month", icon: "📈", earnedDate: null },
];

const golfBadges: Badge[] = [
  { id: "fairway-finder", name: "Fairway Finder", description: "Driving accuracy above 70", icon: "🏌️", earnedDate: "2026-03-20" },
  { id: "putting-pro", name: "Putting Pro", description: "Putting rating above 80", icon: "⛳", earnedDate: null },
  { id: "hot-streak", name: "Hot Streak", description: "4-week consecutive session streak", icon: "🔥", earnedDate: null },
];

export const mockSessions: Record<string, Session[]> = {
  "tennis-1": [
    {
      id: "s1",
      profileId: "tennis-1",
      date: "2026-04-03",
      sport: "tennis",
      durationMinutes: 12,
      overallRating: 68,
      ratings: [
        { name: "Serve", score: 72, justification: "Consistent platform stance with good leg drive. Ball toss drifts slightly right on second serves.", topWeakness: "Second serve toss placement", topStrength: "Strong leg drive and pronation" },
        { name: "Forehand", score: 74, justification: "Semi-western grip with solid contact point. Good hip rotation but follow-through occasionally abbreviated.", topWeakness: "Abbreviated follow-through on wide balls", topStrength: "Consistent contact point and grip" },
        { name: "Backhand", score: 58, justification: "Two-handed with late preparation. Weight transfer tends backward on cross-court attempts.", topWeakness: "Late backswing preparation", topStrength: "Stable wrist through contact" },
        { name: "Net Play", score: 62, justification: "Reasonable split step timing but racket drops between volleys. Good punch on forehand volley.", topWeakness: "Racket drops between volleys", topStrength: "Clean forehand punch volley" },
        { name: "Footwork", score: 70, justification: "Consistent split step before returns. Recovery to center could be faster after wide balls.", topWeakness: "Slow recovery after wide balls", topStrength: "Reliable split step timing" },
        { name: "Strategy", score: 72, justification: "Good court awareness and shot selection on approach shots. Tends to go cross-court too predictably.", topWeakness: "Predictable cross-court pattern", topStrength: "Smart approach shot selection" },
      ],
      weaknesses: ["Backhand preparation timing", "Recovery speed after wide balls", "Second serve toss consistency"],
      strengths: ["Forehand consistency", "Serve power", "Split step timing"],
      drillRecommendations: ["Shadow swing drill for backhand takeback", "Suicide sprints with racket", "Toss placement with target practice"],
      nextChallenge: "Hit 10 consecutive backhands without a late preparation in your next session",
      challengeResult: null,
      pegasusSummary: "Player demonstrates solid fundamentals with a semi-western forehand grip...",
    },
    {
      id: "s2",
      profileId: "tennis-1",
      date: "2026-03-27",
      sport: "tennis",
      durationMinutes: 8,
      overallRating: 64,
      ratings: [
        { name: "Serve", score: 68, justification: "Good first serve placement but inconsistent toss.", topWeakness: "Toss inconsistency", topStrength: "First serve placement" },
        { name: "Forehand", score: 70, justification: "Solid technique with occasional grip slippage.", topWeakness: "Grip stability", topStrength: "Hip rotation" },
        { name: "Backhand", score: 54, justification: "Significant late preparation affecting power.", topWeakness: "Late takeback", topStrength: "Two-handed stability" },
        { name: "Net Play", score: 58, justification: "Hesitant approach to net with low racket position.", topWeakness: "Low racket preparation", topStrength: "Forehand volley angle" },
        { name: "Footwork", score: 66, justification: "Split step present but inconsistent.", topWeakness: "Inconsistent split step", topStrength: "Good first step direction" },
        { name: "Strategy", score: 68, justification: "Reasonable point construction.", topWeakness: "Forced errors on break points", topStrength: "Rally tolerance" },
      ],
      weaknesses: ["Backhand takeback timing", "Net approach hesitancy"],
      strengths: ["Forehand groundstroke", "Rally consistency"],
      drillRecommendations: ["Wall rally backhand drill", "Net rush and volley drill", "Split step reaction drill"],
      nextChallenge: "Approach the net at least 5 times during your next session",
      challengeResult: true,
      pegasusSummary: "Session focused primarily on baseline rallying...",
    },
    {
      id: "s3",
      profileId: "tennis-1",
      date: "2026-03-20",
      sport: "tennis",
      durationMinutes: 15,
      overallRating: 61,
      ratings: [
        { name: "Serve", score: 65, justification: "Developing serve with platform stance.", topWeakness: "Limited leg drive", topStrength: "Consistent toss height" },
        { name: "Forehand", score: 67, justification: "Good foundation with room for follow-through.", topWeakness: "Short follow-through", topStrength: "Early preparation" },
        { name: "Backhand", score: 50, justification: "Struggling with timing and weight transfer.", topWeakness: "Weight falling backward", topStrength: "Grip position" },
        { name: "Net Play", score: 55, justification: "Limited net approaches observed.", topWeakness: "Rarely approaches net", topStrength: "Decent reflexes" },
        { name: "Footwork", score: 62, justification: "Adequate movement but no consistent split step.", topWeakness: "Missing split steps", topStrength: "Court coverage on forehand side" },
        { name: "Strategy", score: 65, justification: "Basic rally strategy present.", topWeakness: "No variation in patterns", topStrength: "Patient point construction" },
      ],
      weaknesses: ["Backhand fundamentals", "Missing split steps"],
      strengths: ["Forehand early preparation", "Patient rallying"],
      drillRecommendations: ["Backhand wall drill", "Split step jump rope", "Target practice serves"],
      nextChallenge: "Execute a split step before every return of serve",
      challengeResult: true,
      pegasusSummary: "Early-stage player showing developing technique...",
    },
  ],
  "golf-1": [
    {
      id: "g1",
      profileId: "golf-1",
      date: "2026-04-01",
      sport: "golf",
      durationMinutes: 10,
      overallRating: 55,
      ratings: [
        { name: "Driving", score: 58, justification: "Good setup position but early extension causes push fades.", topWeakness: "Early extension", topStrength: "Consistent setup alignment" },
        { name: "Iron Play", score: 52, justification: "Fat contact on mid-irons. Ball position slightly too far back.", topWeakness: "Ball position consistency", topStrength: "Tempo on short irons" },
        { name: "Short Game", score: 60, justification: "Decent chipping technique with proper hinge. Distance control needs work.", topWeakness: "Distance control on pitches", topStrength: "Clean chip contact" },
        { name: "Putting", score: 54, justification: "Stroke path slightly outside-in. Good speed control inside 10 feet.", topWeakness: "Outside-in stroke path", topStrength: "Speed control on short putts" },
        { name: "Swing Mechanics", score: 50, justification: "Flat takeaway leading to over-the-top transition.", topWeakness: "Flat takeaway", topStrength: "Good grip pressure" },
        { name: "Course Management", score: 56, justification: "Attempts sensible targets but club selection is aggressive.", topWeakness: "Aggressive club selection", topStrength: "Target-oriented approach" },
      ],
      weaknesses: ["Swing plane", "Iron contact quality", "Putting path"],
      strengths: ["Short game fundamentals", "Setup routine"],
      drillRecommendations: ["Headcover under trail arm drill", "Ball position gate drill", "Putting rail drill"],
      nextChallenge: "Complete 20 putts on the practice green focusing on square face at impact",
      challengeResult: null,
      pegasusSummary: "Golfer shows developing swing mechanics...",
    },
  ],
};

export const mockPlayerCards: Record<string, PlayerCard> = {
  "tennis-1": {
    profileId: "tennis-1",
    playerName: "Alex Chen",
    sport: "tennis",
    overallRating: 68,
    ratings: mockSessions["tennis-1"][0].ratings,
    level: "Competitor",
    streak: 3,
    badges: tennisBadges,
    activeChallenge: "Hit 10 consecutive backhands without a late preparation in your next session",
    challengeSetDate: "2026-04-03",
    totalSessions: 3,
  },
  "golf-1": {
    profileId: "golf-1",
    playerName: "Alex Chen",
    sport: "golf",
    overallRating: 55,
    ratings: mockSessions["golf-1"][0].ratings,
    level: "Club Player",
    streak: 1,
    badges: golfBadges,
    activeChallenge: "Complete 20 putts on the practice green focusing on square face at impact",
    challengeSetDate: "2026-04-01",
    totalSessions: 1,
  },
};

export const mockChatMessages: ChatMessage[] = [
  {
    id: "c1",
    role: "user",
    content: "What's wrong with my backhand?",
    timestamp: "2026-04-03T14:30:00Z",
  },
  {
    id: "c2",
    role: "assistant",
    content: "Based on your last three sessions, your backhand has a consistent issue with late preparation. Your takeback starts too late, which forces you to rush the forward swing and shifts your weight backward rather than into the shot.\n\nSpecifically in your most recent session, the backhand scored 58 — up from 50 three weeks ago, so there is improvement. The main pattern I see:\n\n1. **Late backswing initiation** — you're starting the takeback after the ball crosses the net rather than as your opponent makes contact\n2. **Weight falling backward** on cross-court attempts, which reduces power and consistency\n3. **Stable wrist at contact** — this is actually a strength worth preserving\n\nI'd recommend the shadow swing drill: practice your takeback motion without a ball, focusing on starting the preparation earlier. Try to have your racket back before the ball crosses the net.",
    timestamp: "2026-04-03T14:30:05Z",
  },
];
