import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { bookmarkEvent, Event, listEvents, unbookmarkEvent } from "../api/events";
import { getUnreadCount } from "../api/notifications";
import CollapsibleHeader from "../components/CollapsibleHeader";
import EventCard from "../components/EventCard";
import FiltersSheet from "../components/FiltersSheet";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useScrollAwareHeader } from "../hooks/useScrollAwareHeader";
import { useThemedStyles } from "../hooks/useThemedStyles";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  dayEnd,
  dayStart,
  FeedFilters,
  formatDay,
  KIND_FILTER_LABELS,
  loadFilters,
  radiusChipLabel,
  saveFilters,
  SORT_LABELS,
} from "../lib/feedFilters";
import { distanceKm as kmBetween, formatDistance } from "../lib/geo";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// Icon-flip duration for the light/dark toggle — double ThemeContext's
// FADE_IN_MS (150ms) so the icon is edge-on exactly when `mode` flips.
const ICON_FLIP_MS = 300;

// Home from the Huddle design: a Filters button (location + radius, sort,
// date range — all combinable, see FiltersSheet) + bell, a one-line
// time-of-day greeting, a featured card and the rest of the feed. Data is the real events list; a personalised
// recommendation ranking is still to come (see project notes) — until then
// this surfaces upcoming events soonest-first.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { mode, colors, toggle } = useTheme();
  const flip = useRef(new Animated.Value(0)).current;
  const flipStep = useRef(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  // Greeting hides on scroll-down and returns on any upward scroll.
  const headerScroll = useScrollAwareHeader();
  const [unread, setUnread] = useState(0);

  const { styles } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    brand: { fontSize: fontSize.xl, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      marginRight: spacing.xs,
    },
    filterText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "700" },
    filterBadge: {
      position: "absolute",
      top: -6,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    filterBadgeText: { color: colors.primaryText, fontSize: 10, fontWeight: "800" },
    activeChips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    activeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
    },
    activeChipText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "700", maxWidth: 200 },
    iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    badgeDot: {
      position: "absolute",
      top: 9,
      right: 10,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.background,
    },
    greetingWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md },
    greeting: { fontSize: fontSize.lg, fontWeight: "600", color: colors.textMuted, letterSpacing: -0.2 },
    greetingName: { color: colors.text, fontWeight: "800" },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700" },
    sectionLink: { color: colors.secondary, fontSize: fontSize.sm, fontWeight: "600" },
    feature: {
      marginHorizontal: spacing.lg,
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.xl,
    },
    featureMedia: { height: 200, justifyContent: "flex-end", backgroundColor: colors.primarySoft },
    featureImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
    featureBody: { padding: spacing.lg, gap: spacing.sm },
    featureWhen: {
      alignSelf: "flex-start",
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: radius.sm,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
    },
    featureWhenText: { color: colors.success, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
    featureTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700", letterSpacing: -0.4 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    meta: { color: colors.textMuted, fontSize: fontSize.sm, flexShrink: 1 },
    goingBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.xs,
    },
    going: { color: colors.success, fontSize: fontSize.sm, fontWeight: "700" },
    feed: { paddingHorizontal: spacing.lg },
    empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700" },
    emptyBody: { color: colors.textMuted, fontSize: fontSize.base, textAlign: "center" },
  }));

  useEffect(() => {
    loadFilters().then(setFilters);
  }, []);

  function applyFilters(next: FeedFilters) {
    setFilters(next);
    saveFilters(next);
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, count] = await Promise.all([listEvents(), getUnreadCount().catch(() => ({ unread_count: 0 }))]);
      setEvents(list);
      setUnread(count.unread_count);
    } catch {
      setError("Couldn’t load activities. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleBookmark(event: Event) {
    const next = !event.is_bookmarked;
    setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, is_bookmarked: next } : e)));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, is_bookmarked: !next } : e)));
    }
  }

  function handleToggleTheme() {
    flipStep.current += 1;
    Animated.timing(flip, {
      toValue: flipStep.current,
      duration: ICON_FLIP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    toggle();
  }
  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  // Where distances are measured from: the filter's location if set,
  // otherwise the profile location.
  const originLat = filters.location?.lat ?? user?.location_lat ?? null;
  const originLng = filters.location?.lng ?? user?.location_lng ?? null;
  const originLabel = filters.location?.label ?? user?.location_label ?? null;

  // Distance (km) from the origin per event; online / no-coordinate events
  // have none and are never excluded by the radius.
  const distances = useMemo(() => {
    const map = new Map<string, number>();
    if (originLat == null || originLng == null) return map;
    events.forEach((e) => {
      if (!e.is_online && e.location_lat != null && e.location_lng != null) {
        map.set(e.id, kmBetween(originLat, originLng, e.location_lat, e.location_lng));
      }
    });
    return map;
  }, [events, originLat, originLng]);

  // All filters combine (AND). The date range applies to events only —
  // communities have no date, so they are never excluded by it.
  const filtered = useMemo(() => {
    const fromT = filters.from ? dayStart(filters.from).getTime() : null;
    const toT = filters.to ? dayEnd(filters.to).getTime() : null;
    return events.filter((e) => {
      if (filters.kind !== "all" && e.kind !== filters.kind) return false;
      if (filters.radiusKm !== null) {
        const d = distances.get(e.id);
        if (d !== undefined && d > filters.radiusKm) return false;
      }
      if ((fromT !== null || toT !== null) && e.kind === "event") {
        if (!e.starts_at) return false;
        const t = new Date(e.starts_at).getTime();
        if (fromT !== null && t < fromT) return false;
        if (toT !== null && t > toT) return false;
      } else if (toT !== null && e.kind === "community") {
        // Communities have no single date: they match the range if they
        // already existed by its end (they recur, so they are "active").
        if (new Date(e.created_at).getTime() > toT) return false;
      }
      return true;
    });
  }, [events, distances, filters.kind, filters.radiusKm, filters.from, filters.to]);

  const ordered = useMemo(() => {
    const now = Date.now();
    // Upcoming events soonest-first, then past ones (most recent first),
    // then undated communities.
    const soonest = (a: Event, b: Event) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : null;
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : null;
      const rank = (t: number | null) => (t === null ? 2 : t >= now ? 0 : 1);
      const ra = rank(ta);
      const rb = rank(tb);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return ta! - tb!;
      if (ra === 1) return tb! - ta!;
      return 0;
    };
    const arr = [...filtered];
    if (filters.sort === "nearest") {
      arr.sort((a, b) => {
        const da = distances.get(a.id) ?? Infinity;
        const db = distances.get(b.id) ?? Infinity;
        return da !== db ? da - db : soonest(a, b);
      });
    } else if (filters.sort === "recent") {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      arr.sort(soonest);
    }
    return arr;
  }, [filtered, distances, filters.sort]);
  const featured = ordered.find((e) => e.kind === "event") ?? ordered[0];
  const rest = ordered.filter((e) => e.id !== featured?.id);

  // Minimal time-of-day greeting (night owls get their own line).
  const greeting = (() => {
    const hour = new Date().getHours();
    const name = user?.username ?? "";
    if (hour >= 22 || hour < 5) return { lead: "Hello, ", name: "night owl" };
    if (hour < 12) return { lead: "Good morning, ", name };
    if (hour < 17) return { lead: "Good afternoon, ", name };
    return { lead: "Good evening, ", name };
  })();
  const filterCount = activeFilterCount(filters);
  const shortOrigin = originLabel ? originLabel.split(",")[0] : null;
  const featuredHeading =
    filters.sort === "nearest"
      ? "Closest to you"
      : filters.sort === "recent"
        ? "Just added"
        : filters.kind === "community"
          ? "Communities"
          : "Happening soon";

  // Removable chips summarising the active filters (shown under the greeting).
  const activeChips: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; clear: () => void }[] = [];
  if (filters.kind !== "all") {
    activeChips.push({
      key: "kind",
      label: KIND_FILTER_LABELS[filters.kind],
      icon: filters.kind === "event" ? "calendar-outline" : "people-outline",
      clear: () => applyFilters({ ...filters, kind: "all" }),
    });
  }
  if (filters.location) {
    activeChips.push({
      key: "location",
      label: filters.location.label.split(",")[0],
      icon: "location",
      clear: () => applyFilters({ ...filters, location: null }),
    });
  }
  if (filters.radiusKm !== null) {
    activeChips.push({
      key: "radius",
      label: radiusChipLabel(filters.radiusKm),
      icon: "radio-button-on",
      clear: () => applyFilters({ ...filters, radiusKm: null }),
    });
  }
  if (filters.from || filters.to) {
    const range =
      filters.from && filters.to
        ? filters.from === filters.to
          ? formatDay(filters.from)
          : `${formatDay(filters.from)} – ${formatDay(filters.to)}`
        : filters.from
          ? `From ${formatDay(filters.from)}`
          : `Until ${formatDay(filters.to!)}`;
    activeChips.push({
      key: "dates",
      label: range,
      icon: "calendar-outline",
      clear: () => applyFilters({ ...filters, from: null, to: null }),
    });
  }
  if (filters.sort !== "soonest") {
    activeChips.push({
      key: "sort",
      label: SORT_LABELS[filters.sort],
      icon: "swap-vertical",
      clear: () => applyFilters({ ...filters, sort: "soonest" }),
    });
  }

  // Events show their date; communities (no date) show how often they meet.
  function whenLabel(e: Event): string {
    if (!e.starts_at) return e.frequency ? `Repeats ${FREQUENCY_LABELS[e.frequency].toLowerCase()}` : "Open community";
    const d = new Date(e.starts_at);
    return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }

  // Same kind cues as EventCard: orange + squared for events, teal + round
  // for communities.
  const fIsEvent = featured?.kind === "event";
  const fAccent = fIsEvent ? colors.primary : colors.community;
  const fSoft = fIsEvent ? colors.primarySoft : colors.communitySoft;
  const fRadius = fIsEvent ? radius.sm : radius.pill;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Huddle</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filters"
            style={({ pressed }) => [styles.filterButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="options-outline" size={16} color={colors.text} />
            <Text style={styles.filterText}>Filters</Text>
            {filterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={handleToggleTheme} hitSlop={8} style={styles.iconButton}>
            <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }] }}>
              <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={20} color={colors.textMuted} />
            </Animated.View>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={8} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 && <View style={styles.badgeDot} />}
          </Pressable>
        </View>
      </View>

      <CollapsibleHeader progress={headerScroll.progress}>
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting.lead}
            <Text style={styles.greetingName}>{greeting.name}</Text>
          </Text>
        </View>
        {activeChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChips}>
            {activeChips.map((chip) => (
              <Pressable key={chip.key} onPress={chip.clear} style={styles.activeChip} accessibilityLabel={`Remove ${chip.label} filter`}>
                <Ionicons name={chip.icon} size={13} color={colors.primary} />
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </CollapsibleHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={headerScroll.onScroll("home")}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyBody}>{error}</Text>
          </View>
        ) : !featured ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>{events.length > 0 ? "No matches" : "Nothing here yet"}</Text>
            <Text style={styles.emptyBody}>
              {events.length > 0 && filterCount > 0
                ? `Nothing fits your filters${filters.radiusKm !== null && shortOrigin ? ` within ${filters.radiusKm} km of ${shortOrigin}` : ""}. Try widening them.`
                : "Be the first — tap Create to host an event or start a community."}
            </Text>
            {events.length > 0 && filterCount > 0 && (
              <View style={{ flexDirection: "row", gap: spacing.lg }}>
                <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
                  <Text style={styles.sectionLink}>Edit filters</Text>
                </Pressable>
                <Pressable onPress={() => applyFilters(DEFAULT_FILTERS)} hitSlop={8}>
                  <Text style={styles.sectionLink}>Clear all</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="flame" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>{featuredHeading}</Text>
              </View>
              <Pressable onPress={() => (navigation as any).navigate("Tabs", { screen: "Discover" })} hitSlop={8}>
                <Text style={styles.sectionLink}>Explore ›</Text>
              </Pressable>
            </View>

            <Pressable style={styles.feature} onPress={() => openEventDetail(navigation, featured)}>
              <View style={[styles.featureMedia, { backgroundColor: fSoft }]}>
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 3, backgroundColor: fAccent }} />
                {featured.cover_image_url ? (
                  <Image source={{ uri: mediaUrl(featured.cover_image_url)! }} style={styles.featureImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.featureImage, { alignItems: "center", justifyContent: "center", paddingBottom: spacing.xl }]}>
                    <Ionicons name={EVENT_KIND_ICONS[featured.kind]} size={56} color={fAccent} />
                  </View>
                )}
                <LinearGradient
                  colors={["transparent", colors.surface]}
                  locations={[0.3, 1]}
                  style={styles.featureImage}
                  pointerEvents="none"
                />
                <View
                  style={{
                    position: "absolute",
                    top: spacing.md,
                    left: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    borderWidth: 1,
                    borderColor: fAccent,
                    borderRadius: fRadius,
                    backgroundColor: colors.scrim,
                    paddingVertical: 4,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <Ionicons name={EVENT_KIND_ICONS[featured.kind]} size={13} color={fAccent} />
                  <Text style={{ color: fAccent, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
                    {EVENT_KIND_LABELS[featured.kind]}
                  </Text>
                </View>
              </View>
              <View style={styles.featureBody}>
                <View style={[styles.featureWhen, { borderColor: fAccent, backgroundColor: fSoft, borderRadius: fRadius }]}>
                  <Text style={[styles.featureWhenText, { color: fAccent }]}>{whenLabel(featured)}</Text>
                </View>
                <Text style={styles.featureTitle} numberOfLines={2}>
                  {featured.title}
                </Text>
                {featured.location_label ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location" size={14} color={fAccent} />
                    <Text style={styles.meta} numberOfLines={1}>
                      {featured.location_label}
                      {distances.has(featured.id) ? ` · ${formatDistance(distances.get(featured.id)!)}` : ""}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.goingBar}>
                  <Text style={[styles.going, { color: fIsEvent ? colors.success : colors.community }]}>
                    {featured.kind === "event"
                      ? `${featured.attendee_count} going`
                      : `${featured.member_count} member${featured.member_count === 1 ? "" : "s"}`}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                </View>
              </View>
            </Pressable>

            {rest.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>More for you</Text>
                </View>
                <View style={styles.feed}>
                  {rest.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onPress={(e) => openEventDetail(navigation, e)}
                      onToggleBookmark={toggleBookmark}
                      distanceKm={distances.get(event.id) ?? null}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
      <FiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onApply={applyFilters}
      />
    </View>
  );
}
