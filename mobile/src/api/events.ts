import { api } from "./client";
import { PickedAvatar } from "./profile";

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
export type Frequency = "daily" | "twice_a_week" | "once_a_week" | "irregular";

// Who can join a community: "anyone" (open) or "admin_approval" (a join
// request needs an admin to approve it) — not enforced by any
// join/attendance mechanism yet (see backend app/models/event.py's
// Event.join_policy). Communities only — events are flyer/poster-style with
// no joining, and the backend forces this to "anyone" for kind="event".
export type JoinPolicy = "anyone" | "admin_approval";

// Events only: single fixed-vocabulary category. Must match the Literal
// list in backend/app/schemas/event.py; display labels live in
// mobile/src/constants/eventTags.ts. Used to have three siblings
// (community_vibe/skill_level/event_style) for a fuller tag taxonomy —
// dropped for now while the tag system gets redesigned.
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

export type Event = {
  id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  starts_at: string | null; // ISO 8601 — set for kind="event", null for "community"
  frequency: Frequency | null; // set for kind="community", null for "event"
  is_online: boolean; // events only — always false for "community"
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null; // forced to "Online" server-side when is_online
  creator: EventCreator;
  join_policy: JoinPolicy; // communities only — always "anyone" for "event"
  activity_type: ActivityType | null; // events only — always null for "community"
  // Communities only — the linked ChatGroup id (see backend
  // app/models/event.py's Event.group_id). Null for kind="event". Feed
  // straight into GroupChat's groupId param once is_joined to open the
  // community's group chat.
  group_id: string | null;
  is_bookmarked: boolean;
  // Communities only — "joining" a community *is* becoming a member of its
  // linked group (see group_id above). Always false/0 for kind="event".
  is_joined: boolean;
  member_count: number;
  // Events only — RSVP ("I'm going"), the events analogue of is_joined/
  // member_count above. Always false/0 for kind="community" (see backend
  // app/models/event.py's event_rsvps comment).
  is_rsvped: boolean;
  attendee_count: number;
  created_at: string;
};

export type EventCreatePayload = {
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string | null; // ISO 8601 — required for kind="event", must be null for "community"
  frequency: Frequency | null; // required for kind="community", must be null for "event"
  is_online: boolean;
  location_lat: number | null; // null only when kind="event" and is_online
  location_lng: number | null;
  location_label: string | null;
  join_policy: JoinPolicy;
  activity_type: ActivityType | null;
};

export function createEvent(payload: EventCreatePayload): Promise<Event> {
  return api.authed("/events", { method: "POST", body: JSON.stringify(payload) });
}

// kind omitted = both kinds ("All" on Home). Distance and attendee count
// are meant to join here as more optional fields later, same shape (see the
// backend list_events comment) — join_policy filtering is still supported
// server-side but nothing sends it since kind replaced it as Home's Filter
// chip.
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

// Full-fidelity single-event fetch by id — added for the Discover map's
// marker preview (which only has MapItem's slim shape, see api/map.ts) so
// "View Event"/"View Community" can load the real Event before navigating
// via openEventDetail. Every other screen already has a full Event from the
// list it was opened from, so this isn't used elsewhere.
export function getEvent(id: string): Promise<Event> {
  return api.authed(`/events/${id}`);
}

export function listBookmarkedEvents(): Promise<Event[]> {
  return api.authed("/events/bookmarks");
}

// Posts (events + communities) the current user created — see MyPostsScreen.
export function listMyEvents(): Promise<Event[]> {
  return api.authed("/events/mine");
}

// Creator-only server-side (403 otherwise). full replace, same payload
// shape as createEvent, not a partial patch. See EventForm. Doesn't touch
// cover_image_url — that's set only via uploadEventCover.
export function updateEvent(id: string, payload: EventCreatePayload): Promise<Event> {
  return api.authed(`/events/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

// Creator-only server-side (403 otherwise). Called right after createEvent/
// updateEvent succeeds (from the same "Create/Save" button press) rather
// than folded into that request — there's no event id to save the file
// under until the row exists. Mirrors uploadGroupAvatar. See EventForm.
export function uploadEventCover(eventId: string, asset: PickedAvatar): Promise<Event> {
  const ext = asset.mimeType.split("/")[1] ?? "jpg";
  const form = new FormData();
  form.append("file", asset.file, `cover.${ext}`);
  return api.authed(`/events/${eventId}/cover`, { method: "POST", body: form });
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

// Community only (400 otherwise server-side) — immediate, regardless of
// join_policy. "Anyone"/"admin_approval" is stored but doesn't gate
// anything yet, same as it never did before this endpoint existed; a real
// pending-request/approve flow is future work. Returns the updated event
// (is_joined/member_count refreshed) so the caller can swap it in directly.
export function joinCommunity(id: string): Promise<Event> {
  return api.authed(`/events/${id}/join`, { method: "POST" });
}

export function leaveCommunity(id: string): Promise<Event> {
  return api.authed(`/events/${id}/join`, { method: "DELETE" });
}

// Event only (400 otherwise server-side) — "I'm going". Idempotent, same
// shape as bookmarkEvent/unbookmarkEvent. Returns the updated event
// (is_rsvped/attendee_count refreshed) so the caller can swap it in
// directly, same pattern as joinCommunity/leaveCommunity.
export function rsvpEvent(id: string): Promise<Event> {
  return api.authed(`/events/${id}/rsvp`, { method: "POST" });
}

export function cancelRsvp(id: string): Promise<Event> {
  return api.authed(`/events/${id}/rsvp`, { method: "DELETE" });
}

// Creator-only server-side (403 otherwise), event-only (400 for a
// community — communities use GroupInfo's member list instead). The
// attendee list itself, not just the count — organizer-facing, unlike
// attendee_count on Event which is public. Ordered most-recent-RSVP-first.
export function listEventAttendees(id: string): Promise<EventCreator[]> {
  return api.authed(`/events/${id}/attendees`);
}
