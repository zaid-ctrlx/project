import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { useReduceMotion } from "../hooks/useReduceMotion";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius } from "../theme";

type Option<T extends string> = { key: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
};

// Segmented control whose selected pill glides to the chosen option (with a
// small overshoot) instead of jumping. Equal-width segments.
export default function SlidingSegment<T extends string>({ options, value, onChange, style }: Props<T>) {
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useRef(new Animated.Value(0)).current;
  const segW = width > 0 ? (width - 8) / options.length : 0;

  useEffect(() => {
    if (segW === 0) return;
    if (reduce) {
      x.setValue(index * segW);
      return;
    }
    Animated.timing(x, { toValue: index * segW, duration: 380, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [index, segW, reduce, x]);

  const { styles } = useThemedStyles((colors) => ({
    wrap: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    pill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.inverse },
    item: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9 },
    text: { fontSize: fontSize.sm, fontWeight: "700", color: colors.textMuted },
    textOn: { color: colors.inverseText },
  }));

  return (
    <View style={[styles.wrap, style]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && <Animated.View style={[styles.pill, { width: segW, transform: [{ translateX: x }] }]} />}
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={styles.item}
          onPress={() => onChange(o.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.key === value }}
        >
          <Text style={[styles.text, o.key === value && styles.textOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
