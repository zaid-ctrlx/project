import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";

// Icon-flip duration for the light/dark toggle below — deliberately double
// ThemeContext's FADE_IN_MS (150ms), so the icon is exactly edge-on
// (rotateY 90deg, effectively invisible) at the halfway point, which is the
// instant `mode` actually flips and the icon glyph swaps underneath it.
// Reads as one continuous flip instead of a rotation plus a separate swap.
const ICON_FLIP_MS = 300;

// Bottom-tab Home — reserved for the actual recommendation feed (matching a
// user's activity/follows/interests, see project notes), not built yet.
// Deliberately no search/filter/sort here — Discover (see DiscoverScreen)
// is the one place for those now. Empty "No media" state until the
// recommender exists to fill this in.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { mode, colors, toggle } = useTheme();
  const flip = useRef(new Animated.Value(0)).current;
  // How many half-turns the icon has done so far — the animation always
  // moves *forward* from wherever it last landed (see handleToggleTheme)
  // rather than resetting to 0 first, so consecutive toggles read as one
  // continuous flip instead of a snap back to the start followed by the
  // real animation (that snap was invisible for the radially-symmetric sun
  // glyph but very visible for the crescent moon one).
  const flipStep = useRef(0);
  const { styles } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingBottom: spacing.xxl },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
  }));

  function handleToggleTheme() {
    flipStep.current += 1;
    Animated.timing(flip, {
      toValue: flipStep.current,
      duration: ICON_FLIP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    toggle();
  }

  // No `extrapolate: "clamp"` — flip keeps counting up (1, 2, 3, ...) across
  // toggles, and letting the interpolation extend past the [0,1] range
  // (Animated's default) is what gives every toggle its own fresh 180deg
  // turn from the previous one instead of rewinding first.
  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Hey {user?.username}</Text>
        <Pressable onPress={handleToggleTheme} hitSlop={12}>
          <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }] }}>
            <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={24} color={colors.text} />
          </Animated.View>
        </Pressable>
      </View>
      <View style={styles.empty}>
        <Ionicons name="sparkles-outline" size={40} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>No media</Text>
        <Text style={styles.emptyBody}>Recommendations based on your activity will show up here.</Text>
      </View>
    </View>
  );
}
