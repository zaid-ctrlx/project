import { api } from "./client";

export type EventCreator = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

// "event" (one-time, has starts_at) or "community" (repeating, has
// frequency instead) — two post kinds sharing this same Event type/table
// rather than a second near-identical one (see backend/app/models/event.py's
// Event.kind comment). More kinds are meant to slot in the same way later.
export type EventKind = "event" | "community";

// How often a "community" repeats — no specific day-of-week/time-slot yet,
// just the label (see backend/app/schemas/event.py's FREQUENCY_OPTIONS).
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

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
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string | null; // ISO 8601 — set for kind="event", null for "community"
  frequency: Frequency | null; // set for kind="community", null for "event"
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
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string | null; // ISO 8601 — required for kind="event", must be null for "community"
  frequency: Frequency | null; // required for kind="community", must be null for "event"
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

// kind omitted = both kinds ("All" on Home). Distance, attendee count, and
// category tags are meant to join here as more optional fields later, same
// shape (see the backend list_events comment) — join_policy filtering is
// still supported server-side but nothing sends it since kind replaced it
// as Home's Filter chip.
export type EventListFilters = {
  q?: string;
  kind?: EventKind;
};

export function listEvents(filters?: EventListFilters): Promise<Event[]> {
  const params: string[] = [];
  if (filters?.q) params.push(`q=${encodeURIComponent(filters.q)}`);
  if (filters?.kind) params.push(`kind=${filters.kind}`);
  return api.authed(`/events${params.length ? `?${params.join("&")}` : ""}`);
}

export function listBookmarkedEvents(): Promise<Event[]> {
  return api.authed("/events/bookmarks");
}

// Posts (events + communities) the current user created — see MyPostsScreen.
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
