import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { ActivityType, bookmarkEvent, Event, listEvents, unbookmarkEvent } from "../api/events";
import { getUnreadCount } from "../api/notifications";
import EventCard from "../components/EventCard";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// Icon-flip duration for the light/dark toggle — double ThemeContext's
// FADE_IN_MS (150ms) so the icon is edge-on exactly when `mode` flips.
const ICON_FLIP_MS = 300;

// Home from the Huddle design: location pill + bell, "What are you up for
// today?" greeting, category chips, a featured "Happening near you" card and
// the rest of the feed. Data is the real events list; a personalised
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
  const [category, setCategory] = useState<ActivityType | "all">("all");
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
    intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
    livePill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.successSoft,
      borderRadius: radius.pill,
      paddingVertical: 3,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    liveText: { color: colors.success, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
    headline: { fontSize: 28, lineHeight: 36, fontWeight: "800", color: colors.text, letterSpacing: -0.6 },
    tagline: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    taglineAccent: { color: colors.primary, fontWeight: "700" },
    chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: "600" },
    chipTextActive: { color: colors.primaryText },
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

  // Categories actually present in the data, so every chip leads somewhere.
  const categories = useMemo(() => {
    const counts = new Map<ActivityType, number>();
    events.forEach((e) => e.activity_type && counts.set(e.activity_type, (counts.get(e.activity_type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const filtered = useMemo(
    () => (category === "all" ? events : events.filter((e) => e.activity_type === category)),
    [events, category]
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

  const firstName = user?.full_name?.split(" ")[0] ?? user?.username;

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
          {user?.location_label ? (
            <View style={styles.locationPill}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {user.location_label.split(",")[0]}
              </Text>
            </View>
          ) : null}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
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
        <View style={styles.intro}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{events.length} happening nearby</Text>
          </View>
          <Text style={styles.headline}>
            {firstName ? `${firstName}, what are you up for today?` : "What are you up for today?"}
          </Text>
          <Text style={styles.tagline}>
            Find your people. Find your activity. <Text style={styles.taglineAccent}>Go do it.</Text>
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable onPress={() => setCategory("all")} style={[styles.chip, category === "all" && styles.chipActive]}>
            <Text style={[styles.chipText, category === "all" && styles.chipTextActive]}>All {events.length}</Text>
          </Pressable>
          {categories.map(([key, count]) => (
            <Pressable key={key} onPress={() => setCategory(key)} style={[styles.chip, category === key && styles.chipActive]}>
              <Text style={[styles.chipText, category === key && styles.chipTextActive]}>
                {ACTIVITY_TYPE_LABELS[key]} {count}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

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
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyBody}>Be the first — tap Create to host an event or start a community.</Text>
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
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
