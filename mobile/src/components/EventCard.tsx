import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import { Event } from "../api/events";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
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
  // Bookmarks/My Posts do) keeps every card single-tap, matching how this
  // component always worked before communities got a profile screen.
  onToggleJoin?: (event: Event) => void;
  joinBusy?: boolean;
};

// Reused as-is by Discover, Bookmarks, and My Posts. Kept to a summary —
// name, location, description — so the list scans quickly; everything else
// lives one or two taps away, on EventDetailScreen (events) or
// CommunityProfileScreen (communities, via the expand step above).
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
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    cardPressed: { backgroundColor: colors.chipBackground },
    cover: {
      width: "100%",
      height: 120,
      borderRadius: radius.sm,
      backgroundColor: colors.chipBackground,
      marginBottom: spacing.md,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
    titleCol: { flex: 1 },
    kindBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.chipBackground,
      marginBottom: spacing.xs,
    },
    kindBadgeText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: "600" },
    title: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    meta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
    description: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.sm },
    expandChevron: { alignSelf: "center", marginTop: spacing.sm },
    expandedBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
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

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={handleCardPress}>
      {event.cover_image_url && (
        <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.cover} resizeMode="cover" />
      )}
      <View style={styles.header}>
        <View style={styles.titleCol}>
          <View style={styles.kindBadge}>
            <Ionicons name={EVENT_KIND_ICONS[event.kind]} size={12} color={colors.textMuted} />
            <Text style={styles.kindBadgeText}>{EVENT_KIND_LABELS[event.kind]}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
        </View>
        <Pressable onPress={() => onToggleBookmark(event)} disabled={bookmarkBusy} hitSlop={8}>
          <Ionicons
            name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
            size={22}
            color={event.is_bookmarked ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
      {event.location_label && (
        <Text style={styles.meta} numberOfLines={1}>
          {event.is_online ? "🌐" : "📍"} {event.location_label}
        </Text>
      )}
      {event.description && (
        <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
          {event.description}
        </Text>
      )}

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
    </Pressable>
  );
}
