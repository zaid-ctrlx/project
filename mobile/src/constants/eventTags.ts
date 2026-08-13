// Display labels (with emoji) for the single fixed-vocabulary event
// category field. Backend stores/validates the plain slug values (see
// ACTIVITY_TYPE_OPTIONS in backend/app/schemas/event.py) — this map is the
// mobile-side source of truth for how each slug is shown, and must be kept
// in sync with the backend Literal list by hand.
//
// Used to have three siblings (COMMUNITY_VIBE/SKILL_LEVEL/EVENT_STYLE
// _LABELS) for a fuller tag taxonomy — dropped for now while the tag system
// gets redesigned (see [[fyp-recommender-app-build]] memory).
import { ActivityType } from "../api/events";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  fitness_running: "🏃 Fitness & Running",
  gym_workout: "🏋️ Gym & Workout",
  cycling: "🚴 Cycling",
  trekking: "🏔️ Trekking",
  camping: "🏕️ Camping",
  travel: "✈️ Travel",
  photography: "📸 Photography",
  art_creative: "🎨 Art & Creative",
  gaming: "🎮 Gaming",
  board_games: "♟️ Board Games",
  tech_coding: "💻 Tech & Coding",
  study_learning: "📚 Study & Learning",
  music: "🎵 Music",
  cooking: "🍳 Cooking",
  books_reading: "📖 Books & Reading",
  sports: "⚽ Sports",
  badminton: "🏸 Badminton",
  cricket: "🏏 Cricket",
  public_speaking: "🎤 Public Speaking",
  volunteering: "🤝 Volunteering",
};

// Turns a value->label map into what Select needs (a flat label list) plus
// a reverse lookup, so a screen can hand Select display strings and convert
// the chosen one back to the slug the API expects.
export function labelsToOptions<T extends string>(labels: Record<T, string>) {
  const options = Object.values(labels) as string[];
  const byLabel = Object.fromEntries(Object.entries(labels).map(([value, label]) => [label, value])) as Record<
    string,
    T
  >;
  return { options, byLabel };
}
