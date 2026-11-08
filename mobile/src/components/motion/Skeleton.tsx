import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleProp, ViewStyle } from "react-native";

import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useThemedStyles } from "../../hooks/useThemedStyles";

// A grey placeholder block that gently pulses while real content loads, so the
// page keeps its shape instead of showing a lone spinner.
export default function Skeleton({ height, width = "100%", radius = 14, style }: { height: number; width?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  const { styles } = useThemedStyles((colors) => ({ block: { backgroundColor: colors.chipBackground } }));
  return <Animated.View style={[styles.block, { height, width, borderRadius: radius, opacity: v }, style]} />;
}
