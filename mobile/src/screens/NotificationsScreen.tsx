import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { acceptConnection, listConnectionRequests, removeConnection } from "../api/connections";
import {
  AppNotification,
  listNotifications,
  markAllNotificationsRead as markAllNotificationsReadApi,
  markNotificationRead as markNotificationReadApi,
} from "../api/notifications";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { routeNotification } from "../navigation/routeNotification";
import { fontSize, radius, spacing } from "../theme";

const ICONS: Record<AppNotification["type"], keyof typeof Ionicons.glyphMap> = {
  dm_message: "chatbubble-outline",
  group_message: "people-outline",
  added_to_group: "person-add-outline",
  join_request: "person-add-outline",
  join_approved: "checkmark-circle-outline",
  join_rejected: "close-circle-outline",
  connection_request: "person-add-outline",
  connection_accepted: "people-circle-outline",
  event_reminder: "alarm-outline",
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
  // Requester ids whose request is still waiting on me. Accept/Decline only
  // show for these, so an old notification can never "decline" someone you've
  // already connected with (declining removes the connection).
  const [pendingFrom, setPendingFrom] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Record<string, "accepted" | "declined">>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);
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
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    text: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 2 },
    time: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs },
    empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
    reqActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    reqAccept: { flex: 1, alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.sm },
    reqAcceptText: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: "700" },
    reqDecline: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.sm },
    reqDeclineText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
    reqResult: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: "600", marginTop: spacing.xs },
  }));

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotifications(await listNotifications());
      listConnectionRequests()
        .then((list) => setPendingFrom(new Set(list.map((u) => u.id))))
        .catch(() => {});
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

    routeNotification(navigation, notification.type, notification.data, notification.title);
  }

  async function answerRequest(notification: AppNotification, accept: boolean) {
    const requesterId = notification.data.user_id;
    if (!requesterId || answeringId) return;
    setAnsweringId(notification.id);
    try {
      await (accept ? acceptConnection(requesterId) : removeConnection(requesterId));
      setAnswered((prev) => ({ ...prev, [notification.id]: accept ? "accepted" : "declined" }));
      setPendingFrom((prev) => {
        const next = new Set(prev);
        next.delete(requesterId);
        return next;
      });
      if (!notification.read_at) {
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
        markNotificationReadApi(notification.id).catch(() => {});
      }
    } catch {
      load(); // request may have been withdrawn - refresh what is still pending
    } finally {
      setAnsweringId(null);
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
                {item.type === "connection_request" && answered[item.id] ? (
                  <Text style={styles.reqResult}>{answered[item.id] === "accepted" ? "You're now connected" : "Request declined"}</Text>
                ) : item.type === "connection_request" && pendingFrom.has(item.data.user_id) ? (
                  <View style={styles.reqActions}>
                    <Pressable style={styles.reqDecline} onPress={() => answerRequest(item, false)} disabled={answeringId === item.id}>
                      <Text style={styles.reqDeclineText}>Decline</Text>
                    </Pressable>
                    <Pressable style={styles.reqAccept} onPress={() => answerRequest(item, true)} disabled={answeringId === item.id}>
                      <Text style={styles.reqAcceptText}>{answeringId === item.id ? "..." : "Accept"}</Text>
                    </Pressable>
                  </View>
                ) : null}
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
