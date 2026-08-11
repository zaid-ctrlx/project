import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Event } from "../api/events";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = {
  event: Event;
  onPress: (event: Event) => void;
  onToggleBookmark: (event: Event) => void;
  bookmarkBusy?: boolean;
};

// Reused as-is by both the Discover feed and the Bookmarks list. Kept to a
// summary — name, location, description — so the list scans quickly; every
// other detail (date/time, tags, creator) lives on EventDetailScreen, one
// tap away.
export default function EventCard({ event, onPress, onToggleBookmark, bookmarkBusy }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    card: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    cardPressed: { backgroundColor: colors.chipBackground },
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
  }));

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(event)}
    >
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
          📍 {event.location_label}
        </Text>
      )}
      {event.description && (
        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>
      )}
    </Pressable>
  );
}
