import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import { Event } from "../api/events";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";

type Props = {
  event: Event;
  onPress: (event: Event) => void;
  onToggleBookmark: (event: Event) => void;
  bookmarkBusy?: boolean;
  // Community-only, and opt-in per call site: when provided, tapping a
  // community card expands it in place first (full description + a
  // Join/Leave button) instead of calling onPress immediately; a second tap
  // on the already-expanded card then calls onPress (Discover routes that
  // to CommunityProfileScreen — see openEventDetail). Event cards always
  // call onPress on the first tap regardless. Omitting this prop (as
  // Bookmarks/My Posts do) keeps every card single-tap.
  onToggleJoin?: (event: Event) => void;
  joinBusy?: boolean;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${time}`;
}

// Activity card from the Huddle design: cover (or violet gradient fallback)
// fading into the card surface, category pill + glass bookmark button on the
// cover, a "when" badge, then title/location/description and a footer with
// the going / member count. Reused by Discover, Bookmarks, and My Posts.
export default function EventCard({
  event,
  onPress,
  onToggleBookmark,
  bookmarkBusy,
  onToggleJoin,
  joinBusy,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = event.kind === "community" && !!onToggleJoin;

  const { styles, colors } = useThemedStyles((colors) => ({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
      marginBottom: spacing.lg,
    },
    cardPressed: { borderColor: colors.primary },
    media: { width: "100%", height: 150, backgroundColor: colors.primarySoft, justifyContent: "flex-end" },
    mediaImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    mediaFallback: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    topRow: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.scrim,
    },
    pillText: { fontSize: 11, color: "#faf6f1", fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
    glassButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.scrim,
      alignItems: "center",
      justifyContent: "center",
    },
    whenBadge: {
      position: "absolute",
      left: spacing.md,
      bottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.sm,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: colors.success,
    },
    whenText: { fontSize: 11, color: colors.success, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
    meta: { fontSize: fontSize.sm, color: colors.textMuted },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    description: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
    },
    going: { fontSize: fontSize.sm, color: colors.success, fontWeight: "700" },
    expandChevron: { alignSelf: "center", marginTop: spacing.sm },
    expandedBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    expandedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  }));

  function handleCardPress() {
    if (isExpandable && !expanded) {
      setExpanded(true);
      return;
    }
    onPress(event);
  }

  const isEvent = event.kind === "event";
  const when = event.starts_at ? formatWhen(event.starts_at) : null;
  const count = isEvent ? event.attendee_count : event.member_count;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={handleCardPress}>
      <View style={styles.media}>
        {event.cover_image_url ? (
          <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.mediaImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[colors.primarySoft, colors.surfaceElevated]} style={styles.mediaFallback}>
            <Ionicons name={EVENT_KIND_ICONS[event.kind]} size={44} color={colors.primary} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["transparent", colors.surface]}
          locations={[0.35, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />
        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Ionicons name={EVENT_KIND_ICONS[event.kind]} size={12} color="#faf6f1" />
            <Text style={styles.pillText}>
              {event.activity_type ? ACTIVITY_TYPE_LABELS[event.activity_type] : EVENT_KIND_LABELS[event.kind]}
            </Text>
          </View>
          <Pressable
            onPress={() => onToggleBookmark(event)}
            disabled={bookmarkBusy}
            hitSlop={8}
            style={styles.glassButton}
          >
            <Ionicons
              name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color={event.is_bookmarked ? colors.primary : "#faf6f1"}
            />
          </Pressable>
        </View>
        {when && (
          <View style={styles.whenBadge}>
            <View style={styles.dot} />
            <Text style={styles.whenText}>{when}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {event.location_label && (
          <View style={styles.metaRow}>
            <Ionicons name={event.is_online ? "globe-outline" : "location"} size={14} color={colors.primary} />
            <Text style={styles.meta} numberOfLines={1}>
              {event.location_label}
            </Text>
          </View>
        )}
        {event.description && (
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {event.description}
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.going}>
            {count} {isEvent ? "going" : count === 1 ? "member" : "members"}
          </Text>
          <Text style={styles.meta}>
            {isEvent ? JOIN_POLICY_LABELS[event.join_policy] : FREQUENCY_LABELS[event.frequency ?? "irregular"]}
          </Text>
        </View>

        {isExpandable && !expanded && (
          <Ionicons name="chevron-down" size={16} color={colors.textFaint} style={styles.expandChevron} />
        )}

        {isExpandable && expanded && (
          <View style={styles.expandedBlock}>
            {event.frequency && (
              <View style={styles.expandedRow}>
                <Ionicons name="repeat-outline" size={16} color={colors.textMuted} />
                <Text style={styles.meta}>Repeats {FREQUENCY_LABELS[event.frequency].toLowerCase()}</Text>
              </View>
            )}
            <View style={styles.expandedRow}>
              <Ionicons name="people-outline" size={16} color={colors.textMuted} />
              <Text style={styles.meta}>
                {event.member_count} {event.member_count === 1 ? "member" : "members"} ·{" "}
                {JOIN_POLICY_LABELS[event.join_policy]}
              </Text>
            </View>
            <Button
              label={event.is_joined ? "Leave community" : "Join community"}
              onPress={() => onToggleJoin!(event)}
              loading={joinBusy}
              variant={event.is_joined ? "secondary" : "primary"}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}
