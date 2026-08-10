import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { bookmarkEvent, Event, JoinPolicy, listEvents, unbookmarkEvent } from "../../api/events";
import EventCard from "../../components/EventCard";
import SearchField from "../../components/SearchField";
import { JOIN_POLICY_LABELS, JOIN_POLICY_VALUES } from "../../constants/joinPolicy";
import type { AppStackParamList } from "../../navigation/AppStack";
import { colors, fontSize, radius, spacing } from "../../theme";

// The recommendation feed proper (matching a user's interests/behavior) is
// separate future work — see project notes. This is reverse-chronological
// with basic text search plus filters, which that can later slot into.
//
// Filters so far: join policy only. Distance (nearest first), attendee
// count, and category tags are planned next — each is meant to add one more
// piece of filter state here plus one more field on EventListFilters
// (mobile/src/api/events.ts), same shape as joinPolicyFilter below.
export default function EventDiscoverView() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [query, setQuery] = useState("");
  const [joinPolicyFilter, setJoinPolicyFilter] = useState<JoinPolicy | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, joinPolicy: JoinPolicy | null) => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents({ q: q.trim() || undefined, joinPolicy: joinPolicy ?? undefined }));
    } catch {
      setError("Couldn't load events. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce only really matters for the text field (avoids a request per
    // keystroke); a filter-chip tap is a discrete action, but it's cheap
    // enough to ride the same timer rather than juggle two.
    debounceRef.current = setTimeout(() => load(query, joinPolicyFilter), query ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only re-run when query/filter changes — `load` is stable (useCallback, no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, joinPolicyFilter]);

  async function toggleBookmark(event: Event) {
    const next = !event.is_bookmarked;
    setBusyIds((prev) => new Set(prev).add(event.id));
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_bookmarked: next } : e)));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_bookmarked: !next } : e)));
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
      <SearchField placeholder="Search events" value={query} onChangeText={setQuery} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        <Pressable
          onPress={() => setJoinPolicyFilter(null)}
          style={[styles.filterChip, joinPolicyFilter === null && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, joinPolicyFilter === null && styles.filterChipTextActive]}>All</Text>
        </Pressable>
        {JOIN_POLICY_VALUES.map((jp) => (
          <Pressable
            key={jp}
            onPress={() => setJoinPolicyFilter(jp)}
            style={[styles.filterChip, joinPolicyFilter === jp && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, joinPolicyFilter === jp && styles.filterChipTextActive]}>
              {JOIN_POLICY_LABELS[jp]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={(event) => navigation.navigate("EventDetail", { event })}
              onToggleBookmark={toggleBookmark}
              bookmarkBusy={busyIds.has(item.id)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{error ?? "No events found."}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  filterScroll: { flexGrow: 0, marginTop: spacing.md },
  filterRow: { gap: spacing.sm, paddingRight: spacing.sm },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.chipBackground,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: fontSize.sm, color: colors.text },
  filterChipTextActive: { color: colors.primaryText },
  spinner: { marginTop: spacing.xl },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
});
