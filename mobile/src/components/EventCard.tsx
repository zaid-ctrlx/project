import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Event } from "../api/events";
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
    title: { flex: 1, fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    meta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
    description: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.sm },
  }));

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(event)}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
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
