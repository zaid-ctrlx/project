import { Ionicons } from "@expo/vector-icons";

import { EventKind } from "../api/events";

// Shared by EventCard's kind badge, EventDetailScreen, the Profile "+"
// create-picker sheet, CreatePostScreen's header, and Home's All/Event/
// Community filter — one place for how each kind is labeled/iconed.
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  event: "Event",
  community: "Community",
};

export const EVENT_KIND_ICONS: Record<EventKind, keyof typeof Ionicons.glyphMap> = {
  event: "calendar-outline",
  community: "people-outline",
};
