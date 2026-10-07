import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { mediaUrl } from "../api/client";
import { bookmarkEvent, Event, listEvents, unbookmarkEvent } from "../api/events";
import { getUnreadCount } from "../api/notifications";
import CollapsibleHeader from "../components/CollapsibleHeader";
import EventCard from "../components/EventCard";
import LocationSheet from "../components/LocationSheet";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useScrollAwareHeader } from "../hooks/useScrollAwareHeader";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { distanceKm as kmBetween, formatDistance } from "../lib/geo";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// Icon-flip duration for the light/dark toggle — double ThemeContext's
// FADE_IN_MS (150ms) so the icon is edge-on exactly when `mode` flips.
const ICON_FLIP_MS = 300;

// Home from the Huddle design: location pill (opens the change-location
// sheet) + bell, a one-line time-of-day greeting, a featured card and the
// rest of the feed, limited to the chosen search radius around the location
// saved on the profile. Data is the real events list; a personalised
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
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
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
    locationPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      maxWidth: 190,
    },
    locationText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600", flexShrink: 1 },
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
    AsyncStorage.getItem("feed_radius_km")
      .then((v) => {
        if (v === null) return;
        setRadiusKm(v === "any" ? null : Number(v));
      })
      .catch(() => {
        // default (anywhere) is fine if storage is unavailable
      });
  }, []);

  function changeRadius(km: number | null) {
    setRadiusKm(km);
    AsyncStorage.setItem("feed_radius_km", km === null ? "any" : String(km)).catch(() => {
      // preference just will not persist
    });
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

  // Distance (km) from the chosen location per event; online / no-coordinate
  // events have none and are never excluded by the radius.
  const distances = useMemo(() => {
    const map = new Map<string, number>();
    if (user?.location_lat == null || user?.location_lng == null) return map;
    events.forEach((e) => {
      if (!e.is_online && e.location_lat != null && e.location_lng != null) {
        map.set(e.id, kmBetween(user.location_lat!, user.location_lng!, e.location_lat, e.location_lng));
      }
    });
    return map;
  }, [events, user?.location_lat, user?.location_lng]);

  const filtered = useMemo(
    () => (radiusKm === null ? events : events.filter((e) => !distances.has(e.id) || distances.get(e.id)! <= radiusKm)),
    [events, distances, radiusKm]
  );
  // Soonest upcoming event first (communities have no date, so they trail).
  const ordered = useMemo(() => {
    const now = Date.now();
    return [...filtered].sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      const fa = ta < now ? Infinity : ta;
      const fb = tb < now ? Infinity : tb;
      return fa - fb;
    });
  }, [filtered]);
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
  const cityLabel = user?.location_label ? user.location_label.split(",")[0] : "Set location";

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
            accessibilityLabel="Change location"
            style={({ pressed }) => [styles.locationPill, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {cityLabel}
              {radiusKm !== null ? ` · ${radiusKm} km` : ""}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
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
            <Text style={styles.emptyTitle}>{events.length > 0 ? "Nothing nearby" : "Nothing here yet"}</Text>
            <Text style={styles.emptyBody}>
              {events.length > 0 && radiusKm !== null
                ? `No events or communities within ${radiusKm} km of ${cityLabel}. Try a wider radius or another location.`
                : "Be the first — tap Create to host an event or start a community."}
            </Text>
            {events.length > 0 && radiusKm !== null && (
              <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
                <Text style={styles.sectionLink}>Change location or radius</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="flame" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Happening soon</Text>
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
      <LocationSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        radiusKm={radiusKm}
        onRadiusChange={changeRadius}
      />
    </View>
  );
}
