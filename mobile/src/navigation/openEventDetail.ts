import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Event } from "../api/events";
import type { AppStackParamList } from "./AppStack";

// Events open their poster-style detail screen (EventDetailScreen);
// communities open their richer profile screen (join/leave, member count,
// linked group chat — see CommunityProfileScreen). Shared by every place an
// EventCard is tapped (Discover, Bookmarks, My Posts) so this routing rule
// lives in one place instead of being re-decided at each call site.
export function openEventDetail(navigation: NativeStackNavigationProp<AppStackParamList>, event: Event) {
  if (event.kind === "community") {
    navigation.navigate("CommunityProfile", { event });
  } else {
    navigation.navigate("EventDetail", { event });
  }
}
