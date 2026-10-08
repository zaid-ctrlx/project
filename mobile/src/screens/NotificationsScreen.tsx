import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead as markAllNotificationsReadApi,
  markNotificationRead as markNotificationReadApi,
} from "../api/notifications";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { getEvent } from "../api/events";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

const ICONS: Record<AppNotification["type"], keyof typeof Ionicons.glyphMap> = {
  dm_message: "chatbubble-outline",
  group_message: "people-outline",
  added_to_group: "person-add-outline",
  join_request: "person-add-outline",
  join_approved: "checkmark-circle-outline",
  join_rejected: "close-circle-outline",
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// No nav entry point right now (the Home bell that used to open this was
// pulled for the time being — see HomeScreen) other than tapping an OS push
// notification (see App.tsx's addNotificationResponseListener). Kept working
// and reachable that way rather than deleted, since the notification system
// itself (server-side creation, mute settings, push) is staying — only the
// bell-specific UI/plumbing was cut. Notifications are created server-side
// for DMs, group/community messages (unless muted — see
// GroupInfoScreen/CommunityProfileScreen's mute toggle), and being added to
// a group; see backend app/core/notify.py for the one place that creates
// them. Fetched fresh on every focus rather than live-updated — there's no
// running badge to keep in sync anymore, so a plain re-fetch is simpler than
// wiring into MessagingContext's socket for it.
export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    markAllText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "600" },
    markAllTextDisabled: { color: colors.textFaint },
    spinner: { marginTop: spacing.xl },
    list: { paddingBottom: spacing.xxl },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    title: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flexShrink: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    text: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 2 },
    time: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs },
    empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
  }));

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotifications(await listNotifications());
    } catch {
      setError("Couldn't load your notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onPress(notification: AppNotification) {
    if (!notification.read_at) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      markNotificationReadApi(notification.id).catch(() => {});
    }

    switch (notification.type) {
      case "dm_message":
        // No avatar carried in the notification payload — ChatScreen falls
        // back to an initial-letter placeholder, same as anywhere else in
        // this app a user is shown without one.
        navigation.navigate("Chat", {
          userId: notification.data.sender_id,
          username: notification.title,
          avatarUrl: null,
        });
        break;
      case "group_message":
        // groupName/memberCount are best-effort placeholders — GroupChatScreen
        // fetches the real group detail itself on mount and updates its
        // header once that resolves (see its own comments).
        navigation.navigate("GroupChat", { groupId: notification.data.group_id, groupName: "Group", memberCount: 0 });
        break;
      case "added_to_group":
        navigation.navigate("GroupInfo", { groupId: notification.data.group_id });
        break;
      case "join_request":
        navigation.navigate("JoinRequests", { eventId: notification.data.event_id, eventTitle: "Join requests" });
        break;
      case "join_approved":
      case "join_rejected":
        // Open the community itself (now joinable / joined) -- needs the full
        // event, so fetch it first; if it was deleted meanwhile, do nothing.
        getEvent(notification.data.event_id)
          .then((event) => navigation.navigate("CommunityProfile", { event }))
          .catch(() => {});
        break;
    }
  }

  async function onMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    markAllNotificationsReadApi().catch(() => {});
  }

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={onMarkAllRead} disabled={!hasUnread} hitSlop={12}>
          <Text style={[styles.markAllText, !hasUnread && styles.markAllTextDisabled]}>Mark all read</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onPress(item)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={ICONS[item.type]} size={20} color={colors.textMuted} />
              </View>
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {!item.read_at && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.text} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyBody}>{error ?? "New messages and activity will show up here."}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
