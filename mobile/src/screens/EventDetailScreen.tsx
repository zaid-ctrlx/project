import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import { bookmarkEvent, cancelRsvp, deleteEvent, Event, rsvpEvent, unbookmarkEvent } from "../api/events";
import Button from "../components/Button";
import ConfirmSheet from "../components/ConfirmSheet";
import FadeInUp from "../components/motion/FadeInUp";
import PressableScale from "../components/motion/PressableScale";
import ReportPostLink from "../components/ReportPostLink";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_ICONS, JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useAuth } from "../context/AuthContext";
import { useReduceMotion } from "../hooks/useReduceMotion";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { formatDistance } from "../lib/geo";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Receives the event object straight from the list it was opened from
// (Discover/Bookmarks already fetched it fresh) rather than refetching by
// id - this data is seconds old. Bookmark toggles here are local to this
// screen; the originating list picks up the change next time it remounts.
export default function EventDetailScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "EventDetail">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const reduce = useReduceMotion();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // "I'm going" confirmation: the button pops and a ring ripples out when the
  // RSVP flips to going (skipped on first render and with reduce-motion).
  const pop = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const firstRsvp = useRef(true);
  useEffect(() => {
    if (firstRsvp.current) {
      firstRsvp.current = false;
      return;
    }
    if (reduce || !event.is_rsvped) return;
    ripple.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.94, duration: 90, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
      ]),
      Animated.timing(ripple, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [event.is_rsvped, pop, ripple, reduce]);

  const isEvent = event.kind === "event";
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    hero: { height: 270, backgroundColor: colors.chipBackground, justifyContent: "flex-start" },
    heroFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
    heroBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.32)", alignItems: "center", justifyContent: "center" },
    card: {
      marginHorizontal: spacing.lg,
      marginTop: -44,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 28,
      padding: spacing.lg,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    kindPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
    kindPillText: { fontSize: 12, fontWeight: "800" },
    title: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.7, lineHeight: 31, marginTop: spacing.sm },
    organizer: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
    organizerName: { color: colors.text, fontWeight: "700" },
    tiles: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    tile: { flex: 1, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
    tileLabel: { fontSize: 10, fontWeight: "800", color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.6 },
    tileValue: { fontSize: fontSize.base, fontWeight: "800", color: colors.text },
    tileSub: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    goingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
    goingText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: "700" },
    sectionTitle: { fontSize: 12, fontWeight: "800", color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: spacing.sm },
    description: { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tagChip: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.md, backgroundColor: colors.chipBackground },
    tagChipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
    manageZone: { marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: spacing.sm },
    manageTitle: { fontSize: 12, fontWeight: "800", color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.8 },
    manageError: { color: colors.danger, fontSize: fontSize.base },
    reportWrap: { marginHorizontal: spacing.lg + spacing.xs },
    ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight },
    cta: { flex: 1, height: 54, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    ctaText: { fontSize: fontSize.md, fontWeight: "800" },
    ripple: { position: "absolute", width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  }));

  async function toggleBookmark() {
    const next = !event.is_bookmarked;
    setBookmarkBusy(true);
    setEvent((prev) => ({ ...prev, is_bookmarked: next }));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setEvent((prev) => ({ ...prev, is_bookmarked: !next }));
    } finally {
      setBookmarkBusy(false);
    }
  }

  // Optimistic toggle - event-only (communities use CommunityProfileScreen),
  // server 400s if it somehow got here.
  async function toggleRsvp() {
    const next = !event.is_rsvped;
    setRsvpBusy(true);
    setEvent((prev) => ({
      ...prev,
      is_rsvped: next,
      attendee_count: prev.attendee_count + (next ? 1 : -1),
    }));
    try {
      setEvent(next ? await rsvpEvent(event.id) : await cancelRsvp(event.id));
    } catch {
      setEvent((prev) => ({
        ...prev,
        is_rsvped: !next,
        attendee_count: prev.attendee_count + (next ? -1 : 1),
      }));
    } finally {
      setRsvpBusy(false);
    }
  }

  async function onConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(event.id);
      navigation.goBack();
    } catch (err) {
      setDeleteOpen(false);
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete this event. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  const isCreator = event.creator.id === currentUser?.id;
  const kindColor = isEvent ? colors.event : colors.community;
  const kindSoft = isEvent ? colors.eventSoft : colors.communitySoft;
  const going = event.is_rsvped;

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={{ paddingBottom: isEvent ? 120 + insets.bottom : spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient
            colors={isEvent ? ["#FF9A66", "#B8330B"] : ["#9A8DFF", "#3B2F9E"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroFill}
          />
          {event.cover_image_url ? (
            <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.heroFill} resizeMode="cover" />
          ) : (
            <Ionicons
              name={EVENT_KIND_ICONS[event.kind]}
              size={170}
              color="rgba(255,255,255,0.22)"
              style={{ position: "absolute", right: 8, bottom: 40, transform: [{ rotate: "-10deg" }] }}
            />
          )}
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent"]} style={[styles.heroFill, { height: 120 }]} pointerEvents="none" />
          <View style={[styles.heroBar, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.roundBtn} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </Pressable>
            <Pressable
              onPress={toggleBookmark}
              disabled={bookmarkBusy}
              hitSlop={10}
              style={styles.roundBtn}
              accessibilityLabel={event.is_bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Ionicons name={event.is_bookmarked ? "bookmark" : "bookmark-outline"} size={21} color={event.is_bookmarked ? colors.accent : "#fff"} />
            </Pressable>
          </View>
        </View>

        <FadeInUp>
          <View style={styles.card}>
            <View style={[styles.kindPill, { backgroundColor: kindSoft }]}>
              <Ionicons name={EVENT_KIND_ICONS[event.kind]} size={13} color={kindColor} />
              <Text style={[styles.kindPillText, { color: kindColor }]}>
                {EVENT_KIND_LABELS[event.kind]}
                {event.activity_type ? ` · ${ACTIVITY_TYPE_LABELS[event.activity_type]}` : ""}
              </Text>
            </View>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.organizer}>
              Organised by <Text style={styles.organizerName}>{event.creator.username}</Text>
            </Text>

            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>{isEvent ? "When" : "Meets"}</Text>
                {isEvent && event.starts_at ? (
                  <>
                    <Text style={styles.tileValue}>{formatDay(event.starts_at)}</Text>
                    <Text style={styles.tileSub}>{formatTime(event.starts_at)}</Text>
                  </>
                ) : (
                  <Text style={styles.tileValue}>{event.frequency ? FREQUENCY_LABELS[event.frequency] : "Anytime"}</Text>
                )}
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Where</Text>
                <Text style={styles.tileValue} numberOfLines={2}>
                  {event.is_online ? "Online" : event.location_label ? event.location_label.split(",")[0] : "TBA"}
                </Text>
                <Text style={styles.tileSub} numberOfLines={1}>
                  {event.distance_km != null ? `${formatDistance(event.distance_km)} away` : event.is_online ? "Join from anywhere" : " "}
                </Text>
              </View>
            </View>

            {!isEvent && (
              <View style={styles.goingRow}>
                <Ionicons name={JOIN_POLICY_ICONS[event.join_policy]} size={18} color={colors.textMuted} />
                <Text style={styles.goingText}>{JOIN_POLICY_LABELS[event.join_policy]}</Text>
              </View>
            )}
            {isEvent && event.attendee_count > 0 && (
              <View style={styles.goingRow}>
                <Ionicons name="people" size={18} color={colors.success} />
                <Text style={styles.goingText}>
                  {event.attendee_count} {event.attendee_count === 1 ? "person" : "people"} going
                </Text>
              </View>
            )}

            {event.description ? (
              <>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.description}>{event.description}</Text>
              </>
            ) : null}
          </View>
        </FadeInUp>

        {!isCreator && (
          <View style={styles.reportWrap}>
            <ReportPostLink eventId={event.id} title={event.title} />
          </View>
        )}

        {isCreator && (
          <View style={styles.manageZone}>
            <Text style={styles.manageTitle}>Manage event</Text>
            <Button label="Edit event" variant="secondary" onPress={() => navigation.navigate("EditEvent", { event })} />
            <Button
              label={`View attendees${event.attendee_count > 0 ? ` (${event.attendee_count})` : ""}`}
              variant="secondary"
              onPress={() => navigation.navigate("EventAttendees", { eventId: event.id, eventTitle: event.title })}
            />
            {deleteError && <Text style={styles.manageError}>{deleteError}</Text>}
            <Button label="Delete event" onPress={() => setDeleteOpen(true)} danger />
          </View>
        )}
      </ScrollView>

      {isEvent && (
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Animated.View style={{ flex: 1, transform: [{ scale: pop }] }}>
            <PressableScale
              style={[styles.cta, { backgroundColor: going ? colors.success : colors.accent }]}
              pressedScale={0.97}
              onPress={toggleRsvp}
              disabled={rsvpBusy}
              accessibilityRole="button"
              accessibilityLabel={going ? "You're going. Tap to cancel" : "I'm going"}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ripple,
                  {
                    borderColor: "#fff",
                    opacity: ripple.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 0] }),
                    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.3, 12] }) }],
                  },
                ]}
              />
              <Text style={[styles.ctaText, { color: going ? "#fff" : colors.accentText }]}>
                {rsvpBusy ? "..." : going ? "Going ✓" : "I'm going"}
              </Text>
            </PressableScale>
          </Animated.View>
        </View>
      )}

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete "${event.title}"?`}
        body="This can't be undone - anyone who bookmarked or RSVP'd will lose that too."
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
    </View>
  );
}
