import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontSize, spacing } from "../theme";

// Placeholder only — no backend messaging yet (conversations/messages
// tables, real-time delivery, etc.). Deliberately out of scope for now;
// see FYP proposal's future-work section. This just reserves the tab.
export default function MessagesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Messages</Text>
      <View style={styles.empty}>
        <Ionicons name="paper-plane-outline" size={48} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Coming soon</Text>
        <Text style={styles.emptyBody}>
          Chat with people who share your interests. This is on the way.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
});
