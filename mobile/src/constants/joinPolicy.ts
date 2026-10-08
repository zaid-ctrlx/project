import { Ionicons } from "@expo/vector-icons";

import { Event, JoinPolicy } from "../api/events";

// Communities only — events are flyer/poster-style with no joining (see
// the JoinPolicy type comment). Shared by CreatePostScreen/EditEventScreen
// (choosing it, via EventForm) and EventDetailScreen (showing it).
export const JOIN_POLICY_LABELS: Record<JoinPolicy, string> = {
  anyone: "Anyone can join",
  admin_approval: "Requires admin approval",
};

export const JOIN_POLICY_ICONS: Record<JoinPolicy, keyof typeof Ionicons.glyphMap> = {
  anyone: "lock-open-outline",
  admin_approval: "shield-checkmark-outline",
};

// The join button's wording follows the community's policy and your state:
// open communities say "Join", approval-only ones say "Request to join",
// and once you've asked it becomes "Cancel request" (withdraws it).
export function joinButtonLabel(event: Pick<Event, "is_joined" | "has_requested" | "join_policy">): string {
  if (event.is_joined) return "Leave community";
  if (event.has_requested) return "Cancel request";
  return event.join_policy === "admin_approval" ? "Request to join" : "Join community";
}

// Primary only for the "start joining" action; leaving/cancelling is secondary.
export function joinButtonIsPrimary(event: Pick<Event, "is_joined" | "has_requested">): boolean {
  return !event.is_joined && !event.has_requested;
}
