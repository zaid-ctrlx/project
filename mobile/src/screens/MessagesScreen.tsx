import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { GroupMessage } from "../api/groups";
import { ConversationSummary, listConversations, Message } from "../api/messages";
import SearchField from "../components/SearchField";
import { useMessaging } from "../context/MessagingContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { subscribe, subscribeGroup, isThreadActive, isGroupActive, markRead, markGroupRead } = useMessaging();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
    searchFieldWrap: { marginBottom: spacing.md },
    spinner: { marginTop: spacing.xl },
    list: { paddingBottom: spacing.xl },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: spacing.sm,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
    avatarText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    rowText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    preview: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    rowMeta: { alignItems: "flex-end", gap: spacing.xs },
    timestamp: { fontSize: fontSize.sm, color: colors.textFaint },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
    },
    badgeText: { fontSize: fontSize.sm, color: colors.primaryText, fontWeight: "700" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
    // Mirrors ProfileForm's avatar-source sheet styling exactly (see its
    // comment on why a custom Modal instead of Alert.alert).
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: "hidden",
      paddingVertical: spacing.sm,
    },
    sheetTitle: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    sheetOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    sheetOptionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    sheetOptionPressed: { backgroundColor: colors.chipBackground },
    sheetOptionText: { fontSize: fontSize.md, color: colors.text, textAlign: "center" },
    sheetOptionTextDisabled: { fontSize: fontSize.md, color: colors.textFaint, textAlign: "center" },
    sheetCancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
  }));

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setConversations(await listConversations());
    } catch {
      setError("Couldn't load messages. Check your connection and try again.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  // Source-of-truth resync on every focus — including after backing out of
  // a thread, which stays mounted underneath Chat on the native-stack, so
  // this screen is only unfocused (not unmounted) while a chat is open.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Live updates while mounted — including while merely unfocused (Chat
  // pushed on top), not just while this tab is on screen.
  useEffect(() => {
    return subscribe((message: Message) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.type === "dm" && c.other_user.id === message.sender_id);
        if (idx === -1) {
          // First-ever message from someone not yet in the list — we don't
          // have their profile info from a bare Message payload, so refetch
          // rather than fabricate a partial row.
          load();
          return prev;
        }
        const conv = prev[idx];
        if (conv.type !== "dm") return prev; // narrows for TS; idx's findIndex already guarantees this
        const next = [...prev];
        next.splice(idx, 1);
        next.unshift({
          ...conv,
          last_message: message.body,
          last_message_at: message.created_at,
          last_sender_id: message.sender_id,
          unread_count: isThreadActive(message.sender_id) ? conv.unread_count : conv.unread_count + 1,
        });
        return next;
      });
    });
  }, [subscribe, isThreadActive, load]);

  // Same idea, group side.
  useEffect(() => {
    return subscribeGroup((message: GroupMessage) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.type === "group" && c.group_id === message.group_id);
        if (idx === -1) {
          // Newly added to a group and a message arrived before the next
          // focus-refetch — same fallback as the DM case above.
          load();
          return prev;
        }
        const conv = prev[idx];
        if (conv.type !== "group") return prev;
        const next = [...prev];
        next.splice(idx, 1);
        next.unshift({
          ...conv,
          last_message: message.body,
          last_message_at: message.created_at,
          last_sender_id: message.sender_id,
          unread_count: isGroupActive(message.group_id) ? conv.unread_count : conv.unread_count + 1,
        });
        return next;
      });
    });
  }, [subscribeGroup, isGroupActive, load]);

  function goToChat(userId: string, username: string, avatarUrl: string | null) {
    navigation.navigate("Chat", { userId, username, avatarUrl });
  }

  function goToGroupChat(groupId: string, groupName: string, memberCount: number, unreadCount: number) {
    navigation.navigate("GroupChat", { groupId, groupName, memberCount, unreadCount });
  }

  const hasUnread = conversations.some((c) => c.unread_count > 0);

  // Reuses MessagingContext's per-thread markRead/markGroupRead (each
  // handles its backend call and the shared tab-badge decrement together)
  // once per conversation — there's no bulk mark-all endpoint, but
  // conversation lists here are small enough that N small requests is
  // simpler than adding one.
  async function markAllRead() {
    setMenuOpen(false);
    const unread = conversations.filter((c) => c.unread_count > 0);
    if (unread.length === 0) return;
    await Promise.all(
      unread.map((c) => (c.type === "dm" ? markRead(c.other_user.id, c.unread_count) : markGroupRead(c.group_id, c.unread_count)))
    );
    setConversations((prev) => prev.map((c) => ({ ...c, unread_count: 0 })));
  }

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Tapping search pushes MessageSearch instead of typing in place —
          a real stack screen, so it hides the bottom tab bar and picks up
          swipe-back/hardware-back for free (same reasoning as Home's
          EventDiscoverView.onRequestSearch). */}
      <Pressable style={styles.searchFieldWrap} onPress={() => navigation.navigate("MessageSearch")}>
        <View pointerEvents="none">
          <SearchField placeholder="Search people to message" value="" onChangeText={() => {}} editable={false} />
        </View>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => (item.type === "dm" ? `dm-${item.other_user.id}` : `group-${item.group_id}`)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          renderItem={({ item }) =>
            item.type === "dm" ? (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => goToChat(item.other_user.id, item.other_user.username, item.other_user.avatar_url)}
              >
                {item.other_user.avatar_url ? (
                  <Image source={{ uri: mediaUrl(item.other_user.avatar_url)! }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.other_user.username.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.username}>{item.other_user.username}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.last_message}
                  </Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.timestamp}>{formatTimestamp(item.last_message_at)}</Text>
                  {item.unread_count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => goToGroupChat(item.group_id, item.group_name, item.member_count, item.unread_count)}
              >
                <View style={styles.avatar}>
                  <Ionicons name="people" size={22} color={colors.textMuted} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.username}>{item.group_name}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.last_message || "No messages yet"}
                  </Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.timestamp}>{formatTimestamp(item.last_message_at)}</Text>
                  {item.unread_count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>{error ?? "Search above to start a conversation."}</Text>
            </View>
          }
        />
      )}

      {/* Same custom-sheet pattern as ProfileForm's avatar-source picker
          (see its comment) — works identically on web, unlike Alert.alert. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Messages</Text>
            <Pressable
              onPress={markAllRead}
              disabled={!hasUnread}
              style={({ pressed }) => [
                styles.sheetOption,
                styles.sheetOptionBorder,
                pressed && styles.sheetOptionPressed,
              ]}
            >
              <Text style={[styles.sheetOptionText, !hasUnread && styles.sheetOptionTextDisabled]}>
                Mark all as read
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("CreateGroup");
              }}
              style={({ pressed }) => [
                styles.sheetOption,
                styles.sheetOptionBorder,
                pressed && styles.sheetOptionPressed,
              ]}
            >
              <Text style={styles.sheetOptionText}>New group</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
