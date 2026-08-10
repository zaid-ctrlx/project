import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontSize, radius, spacing } from "../theme";
import BookmarksView from "./events/BookmarksView";
import CreateEventView from "./events/CreateEventView";
import EventDiscoverView from "./events/EventDiscoverView";

type SubTab = "discover" | "create" | "bookmarks";

const TABS: { key: SubTab; label: string }[] = [
  { key: "discover", label: "Discover" },
  { key: "create", label: "Create" },
  { key: "bookmarks", label: "Bookmarks" },
];

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<SubTab>("discover");

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Events</Text>

      <View style={styles.segmented}>
        {TABS.map(({ key, label }) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.segment, tab === key && styles.segmentActive]}>
            <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Conditionally (not always) mounted — switching sub-tabs away and
          back always remounts the target view, so Discover/Bookmarks pick
          up any changes (e.g. a bookmark toggled elsewhere) automatically
          on their own mount-time fetch, with no focus-listener needed. */}
      {tab === "discover" && <EventDiscoverView />}
      {tab === "create" && <CreateEventView onCreated={() => setTab("discover")} />}
      {tab === "bookmarks" && <BookmarksView />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.chipBackground,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
  segmentTextActive: { color: colors.primaryText },
});
