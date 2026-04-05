export type Sport = "tennis" | "golf";

export interface Profile {
  id: string;
  sport: Sport;
  name: string;
}

export interface SkillRating {
  name: string;
  score: number;
  justification: string;
  topWeakness: string;
  topStrength: string;
}

export interface Session {
  id: string;
  profileId: string;
  date: string;
  sport: Sport;
  durationMinutes: number;
  overallRating: number;
  ratings: SkillRating[];
  weaknesses: string[];
  strengths: string[];
  drillRecommendations: string[];
  nextChallenge: string;
  challengeResult: boolean | null;
  pegasusSummary: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate: string | null;
}

export interface PlayerCard {
  profileId: string;
  playerName: string;
  sport: Sport;
  overallRating: number;
  ratings: SkillRating[];
  level: string;
  streak: number;
  badges: Badge[];
  activeChallenge: string | null;
  challengeSetDate: string | null;
  totalSessions: number;
}

export type AnalysisStatus = "idle" | "uploading" | "analyzing" | "scoring" | "ready" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const TENNIS_SKILLS = [
  "Serve",
  "Forehand",
  "Backhand",
  "Net Play",
  "Footwork",
  "Strategy",
];

export const GOLF_SKILLS = [
  "Driving",
  "Iron Play",
  "Short Game",
  "Putting",
  "Swing Mechanics",
  "Course Management",
];

export function getLevelTitle(rating: number): string {
  if (rating >= 90) return "Elite";
  if (rating >= 75) return "Tournament Ready";
  if (rating >= 60) return "Competitor";
  if (rating >= 40) return "Club Player";
  return "Beginner";
}

export function getRatingTier(rating: number): "beginner" | "developing" | "proficient" | "elite" {
  if (rating >= 90) return "elite";
  if (rating >= 70) return "proficient";
  if (rating >= 40) return "developing";
  return "beginner";
}
