import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { MapItem } from "../api/map";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { MAP_MARKER_COLORS, MAP_MARKER_ICONS } from "../constants/mapMarkers";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = {
  item: MapItem | null;
  onClose: () => void;
  onView: (item: MapItem) => void;
  busy?: boolean;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Compact preview shown when a Discover map marker (or, on web, a list row —
// see DiscoverMapView.web) is selected. Deliberately shows only what's
// needed to decide whether to open the full detail screen — name, type,
// short description, date (events only), approximate address — nothing
// about the creator or any other personal info, matching MapItem's
// deliberately slim shape (see api/map.ts).
export default function MapPreviewSheet({ item, onClose, onView, busy }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: radius.md,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    typeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    typeBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: "#ffffff" },
    name: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    metaText: { fontSize: fontSize.base, color: colors.textMuted, flexShrink: 1 },
    description: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.xs },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: spacing.md },
    cancelText: { fontSize: fontSize.md, color: colors.textMuted, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    viewButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    viewButtonPressed: { opacity: 0.85 },
    viewButtonText: { fontSize: fontSize.md, fontWeight: "600", color: colors.primaryText },
  }));

  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {item && (
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.typeRow}>
              <View style={[styles.typeBadge, { backgroundColor: MAP_MARKER_COLORS[item.type] }]}>
                <Ionicons name={MAP_MARKER_ICONS[item.type]} size={12} color="#ffffff" />
                <Text style={styles.typeBadgeText}>{EVENT_KIND_LABELS[item.type]}</Text>
              </View>
            </View>

            <Text style={styles.name}>{item.name}</Text>

            {item.start_date && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={colors.textFaint} />
                <Text style={styles.metaText}>{formatDateTime(item.start_date)}</Text>
              </View>
            )}

            {item.location_name && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color={colors.textFaint} />
                <Text style={styles.metaText} numberOfLines={2}>
                  {item.location_name}
                </Text>
              </View>
            )}

            {item.type === "community" && item.member_count !== null && (
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={16} color={colors.textFaint} />
                <Text style={styles.metaText}>
                  {item.member_count} member{item.member_count === 1 ? "" : "s"}
                </Text>
              </View>
            )}

            {item.type === "event" && item.attendee_count !== null && (
              <View style={styles.metaRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.textFaint} />
                <Text style={styles.metaText}>
                  {item.attendee_count} going
                </Text>
              </View>
            )}

            {item.description && (
              <Text style={styles.description} numberOfLines={3}>
                {item.description}
              </Text>
            )}

            <View style={styles.actions}>
              <Pressable onPress={onClose} disabled={busy}>
                <Text style={styles.cancelText}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => onView(item)}
                disabled={busy}
                style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
              >
                <Text style={styles.viewButtonText}>
                  {busy ? "Opening..." : item.type === "event" ? "View Event" : "View Community"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}
