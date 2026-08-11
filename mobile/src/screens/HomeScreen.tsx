import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";
import EventDiscoverView from "./events/EventDiscoverView";

// Icon-flip duration for the light/dark toggle below — deliberately double
// ThemeContext's FADE_IN_MS (150ms), so the icon is exactly edge-on
// (rotateY 90deg, effectively invisible) at the halfway point, which is the
// instant `mode` actually flips and the icon glyph swaps underneath it.
// Reads as one continuous flip instead of a rotation plus a separate swap.
const ICON_FLIP_MS = 300;

// Bottom-tab Home — what used to be Events' "Discover" sub-tab, promoted to
// its own tab once Events was just My Events, and now the only place to
// browse at all since the Events tab itself is gone (see MainTabs). Shows
// both post kinds — events and communities — filterable via the All/Event/
// Community control in EventDiscoverView.
export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { mode, colors, toggle } = useTheme();
  const flip = useRef(new Animated.Value(0)).current;
  const { styles } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
  }));

  function handleToggleTheme() {
    flip.setValue(0);
    Animated.timing(flip, { toValue: 1, duration: ICON_FLIP_MS, easing: Easing.linear, useNativeDriver: true }).start();
    toggle();
  }

  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
        <Pressable onPress={handleToggleTheme} hitSlop={12}>
          <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }] }}>
            <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={24} color={colors.text} />
          </Animated.View>
        </Pressable>
      </View>
      {/* Tapping search pushes EventSearch instead of typing in place — a
          real stack screen, so it hides the bottom tab bar and picks up
          swipe-back/hardware-back for free (see EventDiscoverView's
          onRequestSearch). Filters + the full list stay right here. */}
      <EventDiscoverView onRequestSearch={() => navigation.navigate("EventSearch")} />
    </View>
  );
}
