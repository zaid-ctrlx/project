import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { bookmarkEvent, Event, JoinPolicy, listEvents, unbookmarkEvent } from "../../api/events";
import EventCard from "../../components/EventCard";
import PickerSheet from "../../components/PickerSheet";
import SearchField from "../../components/SearchField";
import { labelsToOptions } from "../../constants/eventTags";
import { JOIN_POLICY_LABELS } from "../../constants/joinPolicy";
import type { AppStackParamList } from "../../navigation/AppStack";
import { colors, fontSize, radius, spacing } from "../../theme";

const ALL_LABEL = "All";
const JOIN_POLICY_FILTER = labelsToOptions(JOIN_POLICY_LABELS);
const JOIN_POLICY_FILTER_OPTIONS = [ALL_LABEL, ...JOIN_POLICY_FILTER.options];

// Sort has no real options yet ("keep it as it for now, we'll add features
// later") — a fixed, non-interactive label so its chip looks consistent
// next to Filter's without actually offering anything to tap yet (it's not
// a lie: this reverse-chronological order is genuinely what's applied
// today, see list_events in the backend).
const SORT_PLACEHOLDER = "Newest first";

// The recommendation feed proper (matching a user's interests/behavior) is
// separate future work — see project notes. This is reverse-chronological
// with basic text search plus filters, which that can later slot into.
//
// Filters so far: join policy only, defaulting to "All" (no filter applied,
// every event shown) until changed. Distance (nearest first), attendee
// count, and category tags are planned next — each is meant to add one more
// piece of filter state here plus one more field on EventListFilters
// (mobile/src/api/events.ts), same shape as joinPolicyFilter below.
export default function EventDiscoverView() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [query, setQuery] = useState("");
  const [joinPolicyFilter, setJoinPolicyFilter] = useState<JoinPolicy | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one) and shouldn't also yank the
  // list away underneath it.
  const load = useCallback(async (q: string, joinPolicy: JoinPolicy | null, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents({ q: q.trim() || undefined, joinPolicy: joinPolicy ?? undefined }));
    } catch {
      setError("Couldn't load events. Check your connection and try again.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load(query, joinPolicyFilter, { silent: true });
    setRefreshing(false);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce only really matters for the text field (avoids a request per
    // keystroke); a filter change is a discrete action, but it's cheap
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

  const joinPolicyLabel = joinPolicyFilter ? JOIN_POLICY_LABELS[joinPolicyFilter] : ALL_LABEL;

  return (
    <View style={styles.wrapper}>
      <SearchField placeholder="Search events" value={query} onChangeText={setQuery} />

      {/* Small, left/right-anchored chips rather than full-width boxes —
          Filter is real (opens PickerSheet directly, not via Select, since
          Select's labeled-box style is the "too big" look this replaces);
          Sort is a plain View, not a Pressable — inert, not just disabled. */}
      <View style={styles.filterRow}>
        <Pressable style={styles.filterChip} onPress={() => setFilterSheetOpen(true)}>
          <Ionicons name="filter" size={15} color={colors.text} />
          <Text style={styles.filterChipText}>{joinPolicyLabel}</Text>
        </Pressable>
        <View style={[styles.filterChip, styles.filterChipDisabled]}>
          <Text style={[styles.filterChipText, styles.filterChipTextDisabled]}>{SORT_PLACEHOLDER}</Text>
        </View>
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

      <PickerSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter"
        value={joinPolicyLabel}
        options={JOIN_POLICY_FILTER_OPTIONS}
        onChange={(label) => setJoinPolicyFilter(label === ALL_LABEL ? null : JOIN_POLICY_FILTER.byLabel[label])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  filterChipDisabled: { backgroundColor: colors.chipBackground, borderColor: colors.borderLight },
  filterChipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
  filterChipTextDisabled: { color: colors.textFaint },
  spinner: { marginTop: spacing.xl },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
});
