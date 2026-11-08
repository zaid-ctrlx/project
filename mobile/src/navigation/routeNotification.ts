import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { getEvent } from "../api/events";
import type { NotificationType } from "../api/notifications";
import type { AppStackParamList } from "./AppStack";
import { openEventDetail } from "./openEventDetail";

// The one place that decides which screen a notification opens. Used both by
// a tap on a row in the in-app list (NotificationsScreen) and by a tap on the
// OS push notification (see lib/pushNotifications.ts), so the two can never
// drift apart.
export function routeNotification(
  navigation: NativeStackNavigationProp<AppStackParamList>,
  type: NotificationType | string,
  data: Record<string, string>,
  title: string
) {
  switch (type) {
    case "dm_message":
      // No avatar carried in the payload - ChatScreen falls back to an
      // initial-letter placeholder, same as anywhere a user has none.
      navigation.navigate("Chat", { userId: data.sender_id, username: title, avatarUrl: null });
      break;
    case "group_message":
      // groupName/memberCount are placeholders - GroupChatScreen fetches the
      // real group itself on mount and updates its header.
      navigation.navigate("GroupChat", { groupId: data.group_id, groupName: "Group", memberCount: 0 });
      break;
    case "added_to_group":
      navigation.navigate("GroupInfo", { groupId: data.group_id });
      break;
    case "join_request":
      navigation.navigate("JoinRequests", { eventId: data.event_id, eventTitle: "Join requests" });
      break;
    case "connection_request":
      navigation.navigate("Connections", { initialTab: "requests" });
      break;
    case "connection_accepted":
      navigation.navigate("UserProfile", { userId: data.user_id });
      break;
    case "event_reminder":
      // Open the event itself; if it was deleted meanwhile, do nothing.
      getEvent(data.event_id)
        .then((event) => openEventDetail(navigation, event))
        .catch(() => {});
      break;
    case "join_approved":
    case "join_rejected":
      // Open the community itself (now joinable / joined) - needs the full
      // event, so fetch it first; if it was deleted meanwhile, do nothing.
      getEvent(data.event_id)
        .then((event) => navigation.navigate("CommunityProfile", { event }))
        .catch(() => {});
      break;
  }
}
