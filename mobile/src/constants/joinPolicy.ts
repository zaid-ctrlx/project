import { Ionicons } from "@expo/vector-icons";

import { JoinPolicy } from "../api/events";

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
