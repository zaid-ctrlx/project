import { Ionicons } from "@expo/vector-icons";

import { EventKind } from "../api/events";

// Fixed (not theme-dependent) marker colors/icons for the Discover map —
// events vs. communities need to stay visually distinguishable on top of map
// tiles regardless of light/dark app theme, so these are deliberately their
// own palette instead of pulling from theme.ts. Kept in one place so the
// legend and the actual markers can never drift apart.
export const MAP_MARKER_COLORS: Record<EventKind, string> = {
  event: "#FF6A1A", // ember orange
  community: "#2dd4bf", // teal (matches theme.community)
};

export const MAP_MARKER_ICONS: Record<EventKind, keyof typeof Ionicons.glyphMap> = {
  event: "calendar",
  community: "people",
};
