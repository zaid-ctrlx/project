import { Ionicons } from "@expo/vector-icons";

import { JoinPolicy } from "../api/events";

// Shared by CreatePostScreen/EditEventScreen (choosing it, via EventForm)
// and EventDetailScreen (showing it) — was duplicated across the two forms
// until EventForm unified them.
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
