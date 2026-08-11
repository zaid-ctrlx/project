import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";

import { Event, listBookmarkedEvents, unbookmarkEvent } from "../../api/events";
import EventCard from "../../components/EventCard";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { AppStackParamList } from "../../navigation/AppStack";
import { fontSize, spacing } from "../../theme";

export default function BookmarksView() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1 },
    spinner: { marginTop: spacing.xl },
    list: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
    empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
  }));

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one).
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setEvents(await listBookmarkedEvents());
    } catch {
      setError("Couldn't load bookmarks. Check your connection and try again.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  async function removeBookmark(event: Event) {
    setBusyIds((prev) => new Set(prev).add(event.id));
    const prevEvents = events;
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    try {
      await unbookmarkEvent(event.id);
    } catch {
      setEvents(prevEvents);
    } finally {
      setBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(event.id);
        return s;
      });
    }
  }

  return (
    <View style={styles.wrapper}>
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
            <EventCard
              event={item}
              onPress={(event) => navigation.navigate("EventDetail", { event })}
              onToggleBookmark={removeBookmark}
              bookmarkBusy={busyIds.has(item.id)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{error ?? "No bookmarked events yet."}</Text>}
        />
      )}
    </View>
  );
}
