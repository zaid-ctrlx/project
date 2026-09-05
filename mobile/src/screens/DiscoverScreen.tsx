import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { bookmarkEvent, Event, EventKind, getEvent, joinCommunity, leaveCommunity, listEvents, unbookmarkEvent } from "../api/events";
import { listMapItems, MapItem } from "../api/map";
import { searchUsers, UserSearchResult } from "../api/profile";
import EventCard from "../components/EventCard";
import DiscoverMapView from "../components/DiscoverMapView";
import SearchField from "../components/SearchField";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, spacing } from "../theme";

// Instagram search-style section bar: tap a heading or swipe between pages,
// same idea as its For you/Accounts/Audio/Tags row. "All" is truly
// everything — events, communities, *and* accounts, merged into one list
// under section headers (see AllListItem/allItems below) — "Accounts" is
// user search on its own, and Event/Community are each kind on its own —
// see TABS below.
type TabKey = "all" | "accounts" | "event" | "community";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "accounts", label: "Accounts" },
  { key: "event", label: EVENT_KIND_LABELS.event },
  { key: "community", label: EVENT_KIND_LABELS.community },
];

function patchEventList(list: Event[], id: string, patch: Partial<Event>): Event[] {
  return list.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

// The "All" tab's list is heterogeneous (accounts + events/communities), so
// it's one FlatList over a discriminated union instead of EventCard's plain
// Event[] — synthetic "section" items give it the same grouped-with-headers
// look Instagram's own "All" search results have, without pulling in
// SectionList (whose two-generic typing doesn't fit both item shapes any
// more cleanly than this does).
type AllListItem =
  | { kind: "section"; key: string; label: string }
  | { kind: "user"; key: string; user: UserSearchResult }
  | { kind: "event"; key: string; event: Event };

// Reserved for the actual recommendation feed later (matching a user's
// interests/behavior, see project notes) — for now this is the one place
// that searches everything at once: events, communities, and user
// accounts, one shared query fanned out across all four tabs in parallel
// (see load() below) so swiping between them shows real content instead of
// a spinner each time. Home stays the plain reverse-chronological browse
// feed for events/communities only.
export default function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(Dimensions.get("window").width - spacing.xl * 2);

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [onlyEvents, setOnlyEvents] = useState<Event[]>([]);
  const [onlyCommunities, setOnlyCommunities] = useState<Event[]>([]);
  const [people, setPeople] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [joinBusyIds, setJoinBusyIds] = useState<Set<string>>(new Set());
  const [mapMode, setMapMode] = useState(false);
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedMapItem, setSelectedMapItem] = useState<MapItem | null>(null);
  const [mapViewBusy, setMapViewBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollX = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<ScrollView>(null);

  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
    header: { marginBottom: spacing.lg },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
    mapToggle: { alignSelf: "flex-end", paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
    mapToggleText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "600" },
    tabBar: { flexDirection: "row", marginTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    tab: { flex: 1, alignItems: "center", paddingBottom: spacing.md },
    tabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textFaint },
    tabTextActive: { color: colors.text },
    underline: { position: "absolute", bottom: -1, height: 2, backgroundColor: colors.text },
    pager: { flex: 1 },
    page: { flex: 1, paddingTop: spacing.lg },
    spinner: { marginTop: spacing.xl },
    list: { paddingBottom: spacing.xl },
    empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
    sectionHeader: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
    avatarSm: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImageSm: { width: 44, height: 44, borderRadius: 22 },
    avatarSmText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    rowText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  }));

  // Every tab shares one query, fetched in parallel — three /events calls
  // (all kinds, event-only, community-only) plus /users/search, so swiping
  // to a tab you haven't tapped yet still shows real data, not a spinner.
  // search_users requires a non-empty query server-side (deliberately, no
  // "browse all accounts" endpoint — see routes/users.py), so an empty
  // query just clears Accounts instead of calling it.
  const load = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setLoading(true);
    setError(null);
    const [all, onlyE, onlyC, ppl] = await Promise.allSettled([
      listEvents({ q: trimmed || undefined }),
      listEvents({ q: trimmed || undefined, kind: "event" as EventKind }),
      listEvents({ q: trimmed || undefined, kind: "community" as EventKind }),
      trimmed ? searchUsers(trimmed) : Promise.resolve([] as UserSearchResult[]),
    ]);
    setAllEvents(all.status === "fulfilled" ? all.value : []);
    setOnlyEvents(onlyE.status === "fulfilled" ? onlyE.value : []);
    setOnlyCommunities(onlyC.status === "fulfilled" ? onlyC.value : []);
    setPeople(ppl.status === "fulfilled" ? ppl.value : []);
    if ([all, onlyE, onlyC, ppl].some((r) => r.status === "rejected")) {
      setError("Couldn't load some results. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), query ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Also refetch on every focus, not just when the query changes — without
  // this, deleting a community/event from CommunityProfileScreen/MyPostsScreen
  // (or joining/leaving one elsewhere) and swiping back to Discover kept
  // showing the pre-change list until the next keystroke happened to
  // retrigger the debounced effect above. Same "refetch on focus" pattern
  // MyPostsScreen/GroupInfoScreen already use for the same reason.
  useFocusEffect(
    useCallback(() => {
      load(query);
    }, [load, query])
  );

  const loadMap = useCallback(() => {
    if (!mapMode) return Promise.resolve();
    let active = true;
    setMapLoading(true);
    setMapError(null);
    return listMapItems()
      .then((items) => { if (active) setMapItems(items); })
      .catch(() => { if (active) setMapError("Couldn’t load map posts. Check your connection and try again."); })
      .finally(() => { if (active) setMapLoading(false); });
  }, [mapMode]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  async function openMapItem(item: MapItem) {
    setMapViewBusy(true);
    try {
      const event = await getEvent(item.id);
      openEventDetail(navigation, event);
      setSelectedMapItem(null);
    } catch {
      setMapError("Couldn’t open that post. It may have been removed.");
    } finally {
      setMapViewBusy(false);
    }
  }

  async function toggleBookmark(event: Event) {
    const next = !event.is_bookmarked;
    setBusyIds((prev) => new Set(prev).add(event.id));
    setAllEvents((prev) => patchEventList(prev, event.id, { is_bookmarked: next }));
    setOnlyEvents((prev) => patchEventList(prev, event.id, { is_bookmarked: next }));
    setOnlyCommunities((prev) => patchEventList(prev, event.id, { is_bookmarked: next }));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setAllEvents((prev) => patchEventList(prev, event.id, { is_bookmarked: !next }));
      setOnlyEvents((prev) => patchEventList(prev, event.id, { is_bookmarked: !next }));
      setOnlyCommunities((prev) => patchEventList(prev, event.id, { is_bookmarked: !next }));
    } finally {
      setBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(event.id);
        return s;
      });
    }
  }

  // Join/leave return the full updated event (member_count is authoritative
  // server-side, not just a flag to flip locally like bookmark) — patch it
  // into all three lists it might appear in. No optimistic update/rollback
  // here (unlike toggleBookmark) since there's nothing to guess at until
  // the response comes back.
  async function toggleJoin(event: Event) {
    setJoinBusyIds((prev) => new Set(prev).add(event.id));
    try {
      const updated = event.is_joined ? await leaveCommunity(event.id) : await joinCommunity(event.id);
      setAllEvents((prev) => patchEventList(prev, event.id, updated));
      setOnlyEvents((prev) => patchEventList(prev, event.id, updated));
      setOnlyCommunities((prev) => patchEventList(prev, event.id, updated));
    } catch {
      // Nothing was optimistically changed — just leave the card as-is.
    } finally {
      setJoinBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(event.id);
        return s;
      });
    }
  }

  function goToTab(index: number) {
    setActiveIndex(index);
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
  }

  function onScrollEnd(offsetX: number) {
    const index = Math.round(offsetX / pageWidth);
    if (index !== activeIndex) setActiveIndex(index);
  }

  const underlineWidth = pageWidth / TABS.length;
  const underlineX = scrollX.interpolate({ inputRange: [0, pageWidth], outputRange: [0, underlineWidth] });

  // Shared by the Accounts tab and the "All" tab's user rows (see allItems)
  // so the row markup exists in one place.
  function renderPersonRow(item: UserSearchResult) {
    return (
      <Pressable style={styles.row} onPress={() => navigation.navigate("UserProfile", { userId: item.id })}>
        {item.avatar_url ? (
          <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImageSm} />
        ) : (
          <View style={styles.avatarSm}>
            <Text style={styles.avatarSmText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.username}>{item.username}</Text>
          {item.full_name && (
            <Text style={styles.fullName} numberOfLines={1}>
              {item.full_name}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  // Accounts first (section header only if there are any), then events +
  // communities — matches the order the tab bar itself lists Accounts
  // before Event/Community.
  const allItems = useMemo<AllListItem[]>(() => {
    const items: AllListItem[] = [];
    if (people.length > 0) {
      items.push({ kind: "section", key: "section-accounts", label: "Accounts" });
      people.forEach((user) => items.push({ kind: "user", key: `user-${user.id}`, user }));
    }
    if (allEvents.length > 0) {
      items.push({ kind: "section", key: "section-events", label: "Events & Communities" });
      allEvents.forEach((event) => items.push({ kind: "event", key: `event-${event.id}`, event }));
    }
    return items;
  }, [people, allEvents]);

  function allResultsPage() {
    return (
      <View style={[styles.page, { width: pageWidth }]}>
        {loading && allItems.length === 0 ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <FlatList
            data={allItems}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (item.kind === "section") return <Text style={styles.sectionHeader}>{item.label}</Text>;
              if (item.kind === "user") return renderPersonRow(item.user);
              return (
                <EventCard
                  event={item.event}
                  onPress={(event) => openEventDetail(navigation, event)}
                  onToggleBookmark={toggleBookmark}
                  bookmarkBusy={busyIds.has(item.event.id)}
                  onToggleJoin={toggleJoin}
                  joinBusy={joinBusyIds.has(item.event.id)}
                />
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>{error ?? (query.trim() ? "No matches found." : "No events found.")}</Text>
            }
          />
        )}
      </View>
    );
  }

  function eventPage(list: Event[], emptyMessage: string) {
    return (
      <View style={[styles.page, { width: pageWidth }]}>
        {loading && list.length === 0 ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <EventCard
                event={item}
                onPress={(event) => openEventDetail(navigation, event)}
                onToggleBookmark={toggleBookmark}
                bookmarkBusy={busyIds.has(item.id)}
                onToggleJoin={toggleJoin}
                joinBusy={joinBusyIds.has(item.id)}
              />
            )}
            ListEmptyComponent={<Text style={styles.empty}>{error ?? emptyMessage}</Text>}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </View>

      <SearchField placeholder="Search events, communities, accounts" value={query} onChangeText={setQuery} busy={loading} />

      <Pressable onPress={() => setMapMode((value) => !value)} style={styles.mapToggle}>
        <Text style={styles.mapToggleText}>{mapMode ? "List view" : "Map view"}</Text>
      </Pressable>

      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <Pressable key={tab.key} style={styles.tab} onPress={() => goToTab(index)}>
            <Text style={[styles.tabText, activeIndex === index && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
        <Animated.View style={[styles.underline, { width: underlineWidth, transform: [{ translateX: underlineX }] }]} />
      </View>

      {mapMode ? (
        <DiscoverMapView items={mapItems} loading={mapLoading} error={mapError} selected={selectedMapItem} onSelect={setSelectedMapItem} onClose={() => setSelectedMapItem(null)} onView={openMapItem} busy={mapViewBusy} />
      ) : <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => onScrollEnd(e.nativeEvent.contentOffset.x)}
      >
        {allResultsPage()}

        <View style={[styles.page, { width: pageWidth }]}>
          {loading && people.length === 0 && query.trim() ? (
            <ActivityIndicator style={styles.spinner} />
          ) : (
            <FlatList
              data={people}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => renderPersonRow(item)}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {error ?? (query.trim() ? "No users found." : "Type a name or username to search.")}
                </Text>
              }
            />
          )}
        </View>

        {eventPage(onlyEvents, "No events found.")}
        {eventPage(onlyCommunities, "No communities found.")}
      </Animated.ScrollView>}
    </View>
  );
}
