import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { mediaUrl } from "../api/client";
import { bookmarkEvent, Event, getRecommendations, listEvents, listMyPlans, unbookmarkEvent } from "../api/events";
import { getUnreadCount } from "../api/notifications";
import CollapsibleHeader from "../components/CollapsibleHeader";
import EventCard from "../components/EventCard";
import FiltersSheet from "../components/FiltersSheet";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import FadeInUp from "../components/motion/FadeInUp";
import PressableScale from "../components/motion/PressableScale";
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
  minPeopleLabel,
  radiusChipLabel,
  saveFilters,
  SORT_LABELS,
} from "../lib/feedFilters";
import { shortCountdown, startsInLabel } from "../lib/countdown";
import { distanceKm as kmBetween, formatDistance } from "../lib/geo";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// Home from the Huddle design: a Filters button (location + radius, sort,
// date range — all combinable, see FiltersSheet) + bell, a one-line
// "Your plans" dropdown, a "Recommended for you" row (hybrid recommender,
// GET /recommendations — hidden while filters are active), a featured card and
// the rest of the feed (the real events list, soonest-first by default).
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { mode, colors } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [recs, setRecs] = useState<Event[]>([]);
  const [plans, setPlans] = useState<Event[]>([]);
  const [plansOpen, setPlansOpen] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  // Filter chips hide on scroll-down and return on any upward scroll.
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
    brand: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.8 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    searchPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      height: 46,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    searchText: { color: colors.textFaint, fontSize: fontSize.base, fontWeight: "500" },
    filterBtn: { width: 46, height: 46, borderRadius: radius.lg, backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center" },
    kindChips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    kindChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    kindChipOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
    kindChipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: "700" },
    kindChipTextOn: { color: colors.inverseText },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarText: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: "800" },
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
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    filterBadgeText: { color: colors.accentText, fontSize: 10, fontWeight: "800" },
    activeChips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    activeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.inverse,
      borderRadius: radius.pill,
      paddingVertical: 5,
      paddingLeft: spacing.md,
      paddingRight: spacing.sm,
    },
    activeChipText: { color: colors.inverseText, fontSize: fontSize.sm, fontWeight: "700", maxWidth: 200 },
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
    plansToggle: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: 22,
      backgroundColor: mode === "dark" ? colors.primary : colors.tabBar,
      overflow: "hidden",
    },
    plansTitleArea: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
    },
    plansRing: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 3,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    plansRingText: { color: "#F5F3EF", fontSize: 12, fontWeight: "800" },
    plansKicker: { color: "rgba(245,243,239,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
    plansName: { color: "#F5F3EF", fontSize: fontSize.base, fontWeight: "800", marginTop: 2 },
    plansArrow: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      alignSelf: "stretch",
      justifyContent: "center",
    },
    planCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 96,
    },
    planCountdown: { color: colors.accent, fontSize: fontSize.sm, fontWeight: "700" },
    planTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: "700" },
    planMeta: { color: colors.textMuted, fontSize: fontSize.sm },
    recRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
    recCard: {
      width: 164,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: spacing.md,
      gap: spacing.xs,
    },
    recTile: { height: 60, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
    recReason: { alignSelf: "flex-start", color: colors.community, backgroundColor: colors.communitySoft, fontSize: 10, fontWeight: "800", paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, overflow: "hidden" },
    recTitle: { color: colors.text, fontSize: fontSize.base, fontWeight: "800", lineHeight: 18 },
    recMeta: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    hero: { marginHorizontal: spacing.lg, borderRadius: 28, overflow: "hidden", height: 232, marginBottom: spacing.xl },
    heroFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    heroBody: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
    heroPill: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.22)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill },
    heroPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.6, lineHeight: 28 },
    heroMeta: { color: "rgba(255,255,255,0.9)", fontSize: fontSize.sm, fontWeight: "600", marginTop: 4 },
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
      const [list, count, recList, planList] = await Promise.all([
        listEvents(),
        getUnreadCount().catch(() => ({ unread_count: 0 })),
        // Recommendations are an enhancement: if they fail the feed still loads.
        getRecommendations(8).catch(() => [] as Event[]),
        listMyPlans("upcoming").catch(() => [] as Event[]),
      ]);
      setPlans(planList.slice(0, 8));
      setEvents(list);
      setRecs(recList);
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
      if (filters.minPeople > 0) {
        const people = e.kind === "community" ? e.member_count : e.attendee_count;
        if (people < filters.minPeople) return false;
      }
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
  }, [events, distances, filters.kind, filters.radiusKm, filters.minPeople, filters.from, filters.to]);

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

  // Removable chips summarising the active filters (shown under the title row).
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
  if (filters.minPeople > 0) {
    activeChips.push({
      key: "minPeople",
      label: minPeopleLabel(filters.minPeople),
      icon: "people-outline",
      clear: () => applyFilters({ ...filters, minPeople: 0 }),
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
  const fAccent = fIsEvent ? colors.event : colors.community;
  const fSoft = fIsEvent ? colors.eventSoft : colors.communitySoft;
  const fRadius = fIsEvent ? radius.sm : radius.pill;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          huddle<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={8} style={styles.iconButton} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 && <View style={styles.badgeDot} />}
          </Pressable>
          <Pressable
            onPress={() => (navigation as any).navigate("Tabs", { screen: "Profile" })}
            hitSlop={6}
            accessibilityLabel="Your profile"
            style={styles.avatar}
          >
            {user?.avatar_url ? (
              <Image source={{ uri: mediaUrl(user.avatar_url)! }} style={{ width: 40, height: 40 }} />
            ) : (
              <Text style={styles.avatarText}>{(user?.username ?? "?").slice(0, 2).toUpperCase()}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <PressableScale
          style={styles.searchPill}
          pressedScale={0.98}
          onPress={() => (navigation as any).navigate("Tabs", { screen: "Discover" })}
          accessibilityRole="search"
          accessibilityLabel="Search events and communities"
        >
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <Text style={styles.searchText}>Search events & communities</Text>
        </PressableScale>
        <PressableScale style={styles.filterBtn} pressedScale={0.94} onPress={() => setSheetOpen(true)} accessibilityLabel="Filters">
          <Ionicons name="options-outline" size={20} color={colors.inverseText} />
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </PressableScale>
      </View>

      <CollapsibleHeader progress={headerScroll.progress}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindChips}>
          {(["all", "event", "community"] as const).map((k) => {
            const on = filters.kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => applyFilters({ ...filters, kind: k })}
                style={[styles.kindChip, on && styles.kindChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.kindChipText, on && styles.kindChipTextOn]}>{k === "all" ? "All" : KIND_FILTER_LABELS[k]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {activeChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChips}>
            {activeChips.map((chip) => (
              <Pressable key={chip.key} onPress={chip.clear} style={styles.activeChip} accessibilityLabel={`Remove ${chip.label} filter`}>
                <Ionicons name={chip.icon} size={13} color={colors.accent} />
                <Text style={styles.activeChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Ionicons name="close" size={14} color={colors.inverseText} />
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
            {plans.length > 0 && (
              <>
                <View style={styles.plansToggle}>
                  {/* Left: next plan - opens the full My Plans screen. */}
                  <Pressable
                    style={({ pressed }) => [styles.plansTitleArea, pressed && { opacity: 0.8 }]}
                    onPress={() => navigation.navigate("MyPlans")}
                    accessibilityRole="button"
                    accessibilityLabel={`Your plans, ${plans.length}. Next: ${plans[0].title}. Open all plans`}
                  >
                    <View style={styles.plansRing}>
                      <Text style={styles.plansRingText}>{plans[0].starts_at ? shortCountdown(plans[0].starts_at) : ""}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.plansKicker}>
                        YOUR PLANS · {plans.length} · SEE ALL ›
                      </Text>
                      <Text style={styles.plansName} numberOfLines={1}>
                        {plans[0].title}
                      </Text>
                    </View>
                  </Pressable>
                  {/* Right: the arrow - drops the swipeable preview down/up. */}
                  <Pressable
                    style={({ pressed }) => [styles.plansArrow, pressed && { opacity: 0.7 }]}
                    onPress={() => setPlansOpen((o) => !o)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: plansOpen }}
                    accessibilityLabel={plansOpen ? "Hide plan preview" : "Show plan preview"}
                  >
                    <Ionicons name={plansOpen ? "chevron-up" : "chevron-down"} size={22} color="#F5F3EF" />
                  </Pressable>
                </View>
                {plansOpen && (
                  // One plan visible at a time; swipe left for the next.
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={screenWidth - spacing.lg * 2 + spacing.md}
                    decelerationRate="fast"
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                    style={{ marginBottom: spacing.sm }}
                  >
                    {plans.map((p) => (
                      <PressableScale
                        key={p.id}
                        style={[styles.planCard, { width: screenWidth - spacing.lg * 2 }]}
                        onPress={() => openEventDetail(navigation, p)}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.title}, ${startsInLabel(p.starts_at!)}`}
                      >
                        <Text style={styles.planCountdown}>{startsInLabel(p.starts_at!)}</Text>
                        <Text style={styles.planTitle} numberOfLines={2}>
                          {p.title}
                        </Text>
                        <Text style={styles.planMeta} numberOfLines={1}>
                          {whenLabel(p)}
                          {p.location_label ? ` · ${p.location_label.split(",")[0]}` : ""}
                        </Text>
                      </PressableScale>
                    ))}
                  </ScrollView>
                )}
                <View style={{ height: spacing.lg }} />
              </>
            )}
            {filterCount === 0 && recs.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Picked for you</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
                  {recs.map((r) => {
                    const rc = r.kind === "event" ? colors.event : colors.community;
                    return (
                      <PressableScale
                        key={r.id}
                        style={styles.recCard}
                        onPress={() => openEventDetail(navigation, r)}
                        accessibilityRole="button"
                        accessibilityLabel={`${r.title}. ${r.recommendation_reason ?? ""}`}
                      >
                        <View style={[styles.recTile, { backgroundColor: r.kind === "event" ? colors.eventSoft : colors.communitySoft }]}>
                          <Ionicons name={EVENT_KIND_ICONS[r.kind]} size={26} color={rc} />
                        </View>
                        {r.recommendation_reason ? <Text style={styles.recReason}>{r.recommendation_reason}</Text> : null}
                        <Text style={styles.recTitle} numberOfLines={2}>
                          {r.title}
                        </Text>
                        <Text style={styles.recMeta} numberOfLines={1}>
                          {whenLabel(r)}
                          {r.distance_km != null ? ` · ${formatDistance(r.distance_km)} away` : ""}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{featuredHeading}</Text>
              <Pressable onPress={() => (navigation as any).navigate("Tabs", { screen: "Discover" })} hitSlop={8}>
                <Text style={styles.sectionLink}>Explore ›</Text>
              </Pressable>
            </View>

            <FadeInUp>
              <PressableScale style={styles.hero} pressedScale={0.98} onPress={() => openEventDetail(navigation, featured)}>
                <LinearGradient
                  colors={fIsEvent ? ["#FF9A66", "#C2410C"] : ["#9A8DFF", "#3B2F9E"]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.heroFill}
                />
                {featured.cover_image_url ? (
                  <Image source={{ uri: mediaUrl(featured.cover_image_url)! }} style={styles.heroFill} resizeMode="cover" />
                ) : (
                  <Ionicons
                    name={EVENT_KIND_ICONS[featured.kind]}
                    size={150}
                    color="rgba(255,255,255,0.22)"
                    style={{ position: "absolute", right: -10, bottom: -20, transform: [{ rotate: "-10deg" }] }}
                  />
                )}
                <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.6)"]} locations={[0.25, 1]} style={styles.heroFill} pointerEvents="none" />
                <View style={styles.heroBody}>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>{whenLabel(featured)}</Text>
                  </View>
                  <View>
                    <Text style={styles.heroTitle} numberOfLines={2}>
                      {featured.title}
                    </Text>
                    <Text style={styles.heroMeta} numberOfLines={1}>
                      {featured.location_label ? featured.location_label.split(",")[0] : EVENT_KIND_LABELS[featured.kind]}
                      {distances.has(featured.id) ? ` · ${formatDistance(distances.get(featured.id)!)} away` : ""}
                      {` · ${featured.kind === "event" ? `${featured.attendee_count} going` : `${featured.member_count} member${featured.member_count === 1 ? "" : "s"}`}`}
                    </Text>
                  </View>
                </View>
              </PressableScale>
            </FadeInUp>

            {rest.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>More for you</Text>
                </View>
                <View style={styles.feed}>
                  {rest.map((event, i) => (
                    <FadeInUp key={event.id} index={i}>
                      <EventCard
                        event={event}
                        onPress={(e) => openEventDetail(navigation, e)}
                        onToggleBookmark={toggleBookmark}
                        distanceKm={distances.get(event.id) ?? null}
                      />
                    </FadeInUp>
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
