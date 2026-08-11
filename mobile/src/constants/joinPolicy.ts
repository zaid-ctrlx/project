import { Ionicons } from "@expo/vector-icons";

import { JoinPolicy } from "../api/events";

// Shared by CreateEventScreen/EditEventScreen (choosing it, via EventForm),
// EventDetailScreen (showing it), and Home's EventDiscoverView (filtering
// by it) — was duplicated across the first two until the filter became a
// third use site.
export const JOIN_POLICY_LABELS: Record<JoinPolicy, string> = {
  open: "Anyone can join",
  invite_only: "Invited only",
  closed: "Closed",
};

export const JOIN_POLICY_ICONS: Record<JoinPolicy, keyof typeof Ionicons.glyphMap> = {
  open: "lock-open-outline",
  invite_only: "mail-outline",
  closed: "lock-closed-outline",
};
