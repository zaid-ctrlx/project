import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { bookmarkEvent, Event, EventKind, listEvents, unbookmarkEvent } from "../../api/events";
import EventCard from "../../components/EventCard";
import SearchField from "../../components/SearchField";
import { EVENT_KIND_LABELS } from "../../constants/eventKind";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { AppStackParamList } from "../../navigation/AppStack";
import { fontSize, radius, spacing } from "../../theme";

const ALL_LABEL = "All";
const KIND_FILTERS: { key: EventKind | null; label: string }[] = [
  { key: null, label: ALL_LABEL },
  { key: "event", label: EVENT_KIND_LABELS.event },
  { key: "community", label: EVENT_KIND_LABELS.community },
];

// Sort has no real options yet ("keep it as it for now, we'll add features
// later") — a fixed, non-interactive label so its chip still shows what's
// genuinely applied today (reverse-chronological, see list_events in the
// backend) without offering anything to tap yet.
const SORT_PLACEHOLDER = "Newest first";

type Props = {
  // Autofocuses the search input on mount — set by EventSearchScreen, whose
  // whole reason for existing is to drop the user straight into typing.
  autoFocus?: boolean;
  // When set, the search field becomes a display-only tap target (wrapped
  // in a Pressable) that calls this instead of accepting input — Home uses
  // it to hand typing off to EventSearchScreen (a real stack push, so it
  // gets the tab bar hidden and swipe-back/hardware-back for free, neither
  // of which a same-screen "search mode" toggle could do). Filters and the
  // (unfiltered) list underneath stay fully interactive either way — only
  // the text query is deferred to that screen.
  onRequestSearch?: () => void;
};

// The recommendation feed proper (matching a user's interests/behavior) is
// separate future work — see project notes. This is reverse-chronological
// with basic text search plus a kind filter, which that can later slot into.
//
// Filters so far: post kind (All/Event/Community, defaulting to All — every
// post shown) via the segmented control below. Distance (nearest first),
// attendee count, and category tags are planned next — each is meant to add
// one more piece of filter state here plus one more field on
// EventListFilters (mobile/src/api/events.ts), same shape as kindFilter.
export default function EventDiscoverView({ autoFocus, onRequestSearch }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<EventKind | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1 },
    kindRow: {
      flexDirection: "row",
      backgroundColor: colors.chipBackground,
      borderRadius: radius.pill,
      padding: spacing.xs,
      marginTop: spacing.md,
    },
    kindSegment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: "center" },
    kindSegmentActive: { backgroundColor: colors.primary },
    kindSegmentText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textMuted },
    kindSegmentTextActive: { color: colors.primaryText },
    sortRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.sm },
    sortChip: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.chipBackground,
    },
    sortChipText: { fontSize: fontSize.sm, color: colors.textFaint, fontWeight: "600" },
    spinner: { marginTop: spacing.xl },
    list: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
    empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
  }));

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one) and shouldn't also yank the
  // list away underneath it.
  const load = useCallback(async (q: string, kind: EventKind | null, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setEvents(await listEvents({ q: q.trim() || undefined, kind: kind ?? undefined }));
    } catch {
      setError("Couldn't load events. Check your connection and try again.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load(query, kindFilter, { silent: true });
    setRefreshing(false);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce only really matters for the text field (avoids a request per
    // keystroke); a filter change is a discrete action, but it's cheap
    // enough to ride the same timer rather than juggle two.
    debounceRef.current = setTimeout(() => load(query, kindFilter), query ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Only re-run when query/filter changes — `load` is stable (useCallback, no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kindFilter]);

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

  const searchField = (
    <SearchField
      placeholder="Search events"
      value={query}
      onChangeText={setQuery}
      editable={!onRequestSearch}
      autoFocus={autoFocus}
    />
  );

  return (
    <View style={styles.wrapper}>
      {onRequestSearch ? (
        <Pressable onPress={onRequestSearch}>
          <View pointerEvents="none">{searchField}</View>
        </Pressable>
      ) : (
        searchField
      )}

      <View style={styles.kindRow}>
        {KIND_FILTERS.map(({ key, label }) => (
          <Pressable
            key={label}
            onPress={() => setKindFilter(key)}
            style={[styles.kindSegment, kindFilter === key && styles.kindSegmentActive]}
          >
            <Text style={[styles.kindSegmentText, kindFilter === key && styles.kindSegmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Inert — "not built yet", see SORT_PLACEHOLDER. Not a Pressable,
          unlike the segmented control above, since it doesn't do anything yet. */}
      <View style={styles.sortRow}>
        <View style={styles.sortChip}>
          <Text style={styles.sortChipText}>{SORT_PLACEHOLDER}</Text>
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
    </View>
  );
}
