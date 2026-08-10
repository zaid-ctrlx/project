// Display labels (with emoji) for the four fixed-vocabulary event category
// fields. Backend stores/validates the plain slug values (see
// ACTIVITY_TYPE_OPTIONS etc. in backend/app/schemas/event.py) — these maps
// are the mobile-side source of truth for how each slug is shown, and must
// be kept in sync with the backend Literal lists by hand.
import { ActivityType, CommunityVibe, EventStyle, SkillLevel } from "../api/events";

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

export const COMMUNITY_VIBE_LABELS: Record<CommunityVibe, string> = {
  friendly: "😊 Friendly",
  beginner_friendly: "🌱 Beginner Friendly",
  competitive: "🔥 Competitive",
  chill_relaxed: "😌 Chill & Relaxed",
  social: "💬 Social",
  skill_focused: "🧠 Skill-Focused",
  goal_oriented: "🏆 Goal-Oriented",
  team_based: "🤝 Team-Based",
  meet_new_people: "🧑‍🤝‍🧑 Meet New People",
  small_group: "🏠 Small Group",
  open_to_everyone: "🌎 Open to Everyone",
};

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  beginners: "🌱 Beginners",
  intermediate: "🔰 Intermediate",
  advanced: "💪 Advanced",
  all_skill_levels: "🏆 All Skill Levels",
  learning_together: "🎓 Learning Together",
  skill_sharing: "👨‍🏫 Skill Sharing",
};

export const EVENT_STYLE_LABELS: Record<EventStyle, string> = {
  quick_meetup: "⚡ Quick Meetup",
  regular_meetup: "📅 Regular Meetup",
  competition: "🏆 Competition",
  workshop: "💡 Workshop",
  discussion: "🧠 Discussion",
  challenge: "🚀 Challenge",
  adventure: "🗺️ Adventure",
  social_gathering: "🎉 Social Gathering",
  networking: "🤝 Networking",
  group_activity: "🧑‍🤝‍🧑 Group Activity",
  talk_session: "🎤 Talk / Session",
  hands_on: "🛠️ Hands-On",
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
