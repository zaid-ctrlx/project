import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { MAP_MARKER_COLORS, MAP_MARKER_ICONS } from "../constants/mapMarkers";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

// Small legend overlay explaining the two marker types. Colors/icons come
// from mapMarkers.ts so the legend and the markers can't drift apart.
export default function MapLegend() {
  const { styles } = useThemedStyles((colors) => ({
    legend: { position: "absolute", zIndex: 1000, left: spacing.md, bottom: spacing.md, flexDirection: "row", gap: spacing.md, backgroundColor: colors.background, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, opacity: 0.95 },
    item: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    dot: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    label: { color: colors.text, fontSize: fontSize.sm },
  }));
  return (
    <View style={styles.legend} pointerEvents="none">
      {(["event", "community"] as const).map((kind) => (
        <View key={kind} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: MAP_MARKER_COLORS[kind] }]}>
            <Ionicons name={MAP_MARKER_ICONS[kind]} size={10} color="#fff" />
          </View>
          <Text style={styles.label}>{EVENT_KIND_LABELS[kind]}</Text>
        </View>
      ))}
    </View>
  );
}
