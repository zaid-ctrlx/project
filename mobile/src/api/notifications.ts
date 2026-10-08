import { api } from "./client";

export type NotificationType =
  | "dm_message"
  | "group_message"
  | "added_to_group"
  // Community join flow: admins get join_request; the applicant gets
  // join_approved / join_rejected. All carry data.event_id.
  | "join_request"
  | "join_approved"
  | "join_rejected";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  // Shape depends on `type` — dm_message/group_message carry sender_id,
  // group_message/added_to_group carry group_id. Read loosely by whichever
  // screen navigates off it (see NotificationsScreen).
  data: Record<string, string>;
  created_at: string;
  read_at: string | null;
};

export function listNotifications(limit = 30, offset = 0): Promise<AppNotification[]> {
  return api.authed(`/notifications?limit=${limit}&offset=${offset}`);
}

export function getUnreadCount(): Promise<{ unread_count: number }> {
  return api.authed("/notifications/unread-count");
}

export function markNotificationRead(id: string): Promise<void> {
  return api.authed(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead(): Promise<void> {
  return api.authed("/notifications/read-all", { method: "POST" });
}

// Not currently called from anywhere — the client-side expo-notifications
// integration (permission request, getExpoPushTokenAsync, wiring these into
// AuthContext's login/logout) was pulled out entirely: importing
// expo-notifications at all crashes the app on Android in Expo Go with SDK
// 57 ("Android Push notifications... was removed from Expo Go"), which is
// what's still in use for dev — see the FYP build memory for the full
// story. Kept here, matching the backend endpoints, for whenever this
// project moves to a custom dev client and it's safe to wire back up.
// Re-registering the same token is a safe no-op server-side (upsert).
export function registerPushToken(token: string): Promise<void> {
  return api.authed("/notifications/push-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// Best-effort, called on logout so a shared/reset device stops receiving
// this account's pushes.
export function unregisterPushToken(token: string): Promise<void> {
  return api.authed("/notifications/push-token", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
