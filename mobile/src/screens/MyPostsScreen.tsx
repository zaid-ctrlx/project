import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bookmarkEvent, deleteEvent, Event, listMyEvents, unbookmarkEvent } from "../api/events";
import ConfirmDeleteSheet from "../components/ConfirmDeleteSheet";
import ConfirmSheet from "../components/ConfirmSheet";
import EventCard from "../components/EventCard";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, spacing } from "../theme";

// Pushed from Profile > Settings ("My Posts" row) — was the Events tab
// (formerly a 3-way segmented Discover/Create/Bookmarks screen, then just
// "My Events" once those moved out; now events and communities together,
// now that Events is gone from the tab bar entirely — see MainTabs).
// Refetches on every focus (not just mount), so coming back here after an
// edit/create shows the change immediately.
export default function MyPostsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkBusyIds, setBookmarkBusyIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    headerSpacer: { width: 26 },
    spinner: { marginTop: spacing.xl },
    list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
    cardWrap: { marginBottom: spacing.md },
    actionRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
      marginTop: -spacing.sm,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: spacing.sm,
    },
    actionButtonPressed: { backgroundColor: colors.chipBackground },
    actionText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    deleteText: { color: colors.danger },
    empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
  }));

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setEvents(await listMyEvents());
    } catch {
      setError("Couldn't load your posts. Check your connection and try again.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  async function toggleBookmark(event: Event) {
    const next = !event.is_bookmarked;
    setBookmarkBusyIds((prev) => new Set(prev).add(event.id));
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_bookmarked: next } : e)));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_bookmarked: !next } : e)));
    } finally {
      setBookmarkBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(event.id);
        return s;
      });
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Couldn't delete this. Try again.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Posts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <EventCard
                event={item}
                onPress={(event) => openEventDetail(navigation, event)}
                onToggleBookmark={toggleBookmark}
                bookmarkBusy={bookmarkBusyIds.has(item.id)}
              />
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                  onPress={() => navigation.navigate("EditEvent", { event: item })}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.text} />
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                  onPress={() => setDeleteTarget(item)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? "You haven't created any events or communities yet."}</Text>
          }
        />
      )}

      {/* Communities take other members' membership and group chat history
          down with them, not just this one post — the typed-confirmation
          sheet (same one GroupInfo/CommunityProfile use) instead of the
          plain yes/no every other delete here gets. */}
      <ConfirmSheet
        visible={!!deleteTarget && deleteTarget.kind === "event"}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title}"?`}
        body="This can't be undone — anyone who bookmarked it will lose that too."
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
      <ConfirmDeleteSheet
        visible={!!deleteTarget && deleteTarget.kind === "community"}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title}"?`}
        body="Every member loses their membership and the group chat's entire message history. This can't be undone."
        confirmLabel="Delete community"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
    </View>
  );
}
