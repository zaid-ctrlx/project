import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OptionsMenu from "../components/OptionsMenu";
import type { AppStackParamList } from "../navigation/AppStack";
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
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [tab, setTab] = useState<SubTab>("discover");
  // Filter/Sort turned out to belong inline on Discover (below its search
  // bar, see EventDiscoverView), not here — "My Events" is this menu's
  // first real item.
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </Pressable>
      </View>

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

      <OptionsMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Events"
        items={[{ label: "My Events", onPress: () => navigation.navigate("MyEvents") }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
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
