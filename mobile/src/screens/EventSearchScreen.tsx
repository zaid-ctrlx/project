import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { spacing } from "../theme";
import EventDiscoverView from "./events/EventDiscoverView";

// Pushed from Home's search bar (see EventDiscoverView's onRequestSearch).
// Being a real stack screen — not just local state on Home — is the whole
// point: it hides the bottom tab bar automatically (same as Settings/Chat/
// any other pushed screen) and gets swipe-back (iOS) and the hardware back
// button (Android) for free, so search can only be left the same way any
// other pushed screen is left, not by switching tabs.
export default function EventSearchScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    body: { flex: 1, paddingHorizontal: spacing.xl },
  }));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <EventDiscoverView autoFocus />
      </View>
    </View>
  );
}
