import { Ionicons } from "@expo/vector-icons";

import { JoinPolicy } from "../api/events";

// Shared by CreateEventView (choosing it), EventDetailScreen (showing it),
// and EventDiscoverView (filtering by it) — was duplicated across the first
// two until the filter became a third use site.
export const JOIN_POLICY_VALUES: JoinPolicy[] = ["open", "invite_only", "closed"];

export const JOIN_POLICY_LABELS: Record<JoinPolicy, string> = {
  open: "Anyone can join",
  invite_only: "Invite only",
  closed: "Temporarily closed",
};

export const JOIN_POLICY_ICONS: Record<JoinPolicy, keyof typeof Ionicons.glyphMap> = {
  open: "lock-open-outline",
  invite_only: "mail-outline",
  closed: "lock-closed-outline",
};
