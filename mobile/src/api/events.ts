import { api } from "./client";

export type EventCreator = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

// Who can join. Editable after creation now (see updateEvent) — there's
// still no join/attendance mechanism yet for this to actually gate, though
// (see backend app/models/event.py's Event.join_policy).
export type JoinPolicy = "open" | "invite_only" | "closed";

// Four fixed-vocabulary, single-select category fields (replaces the
// earlier free-form multi-tag system). Must match the Literal lists in
// backend/app/schemas/event.py; display labels live in
// mobile/src/constants/eventTags.ts.
export type ActivityType =
  | "fitness_running"
  | "gym_workout"
  | "cycling"
  | "trekking"
  | "camping"
  | "travel"
  | "photography"
  | "art_creative"
  | "gaming"
  | "board_games"
  | "tech_coding"
  | "study_learning"
  | "music"
  | "cooking"
  | "books_reading"
  | "sports"
  | "badminton"
  | "cricket"
  | "public_speaking"
  | "volunteering";

export type CommunityVibe =
  | "friendly"
  | "beginner_friendly"
  | "competitive"
  | "chill_relaxed"
  | "social"
  | "skill_focused"
  | "goal_oriented"
  | "team_based"
  | "meet_new_people"
  | "small_group"
  | "open_to_everyone";

export type SkillLevel =
  | "beginners"
  | "intermediate"
  | "advanced"
  | "all_skill_levels"
  | "learning_together"
  | "skill_sharing";

export type EventStyle =
  | "quick_meetup"
  | "regular_meetup"
  | "competition"
  | "workshop"
  | "discussion"
  | "challenge"
  | "adventure"
  | "social_gathering"
  | "networking"
  | "group_activity"
  | "talk_session"
  | "hands_on";

export type Event = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string; // ISO 8601
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  creator: EventCreator;
  join_policy: JoinPolicy;
  activity_type: ActivityType | null;
  community_vibe: CommunityVibe | null;
  skill_level: SkillLevel | null;
  event_style: EventStyle | null;
  is_bookmarked: boolean;
  created_at: string;
};

export type EventCreatePayload = {
  title: string;
  description: string | null;
  starts_at: string; // ISO 8601
  location_lat: number;
  location_lng: number;
  location_label: string;
  join_policy: JoinPolicy;
  activity_type: ActivityType | null;
  community_vibe: CommunityVibe | null;
  skill_level: SkillLevel | null;
  event_style: EventStyle | null;
};

export function createEvent(payload: EventCreatePayload): Promise<Event> {
  return api.authed("/events", { method: "POST", body: JSON.stringify(payload) });
}

// First of several planned filters (see the backend list_events comment) —
// distance, attendee count, and category tags are meant to join joinPolicy
// here as more optional fields, same shape.
export type EventListFilters = {
  q?: string;
  joinPolicy?: JoinPolicy;
};

export function listEvents(filters?: EventListFilters): Promise<Event[]> {
  const params: string[] = [];
  if (filters?.q) params.push(`q=${encodeURIComponent(filters.q)}`);
  if (filters?.joinPolicy) params.push(`join_policy=${filters.joinPolicy}`);
  return api.authed(`/events${params.length ? `?${params.join("&")}` : ""}`);
}

export function listBookmarkedEvents(): Promise<Event[]> {
  return api.authed("/events/bookmarks");
}

// Events the current user created — see MyEventsScreen.
export function listMyEvents(): Promise<Event[]> {
  return api.authed("/events/mine");
}

// Creator-only server-side (403 otherwise) — full replace, same payload
// shape as createEvent, not a partial patch. See EventForm.
export function updateEvent(id: string, payload: EventCreatePayload): Promise<Event> {
  return api.authed(`/events/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

// Creator-only server-side (403 otherwise).
export function deleteEvent(id: string): Promise<void> {
  return api.authed(`/events/${id}`, { method: "DELETE" });
}

export function bookmarkEvent(id: string): Promise<void> {
  return api.authed(`/events/${id}/bookmark`, { method: "POST" });
}

export function unbookmarkEvent(id: string): Promise<void> {
  return api.authed(`/events/${id}/bookmark`, { method: "DELETE" });
}
