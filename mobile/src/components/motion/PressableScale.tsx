import React, { useMemo, useRef } from "react";
import { Animated, Easing, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { useReduceMotion } from "../../hooks/useReduceMotion";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  // How far it shrinks while held (1 = no shrink).
  pressedScale?: number;
};

// Style keys that decide where the component sits in its parent. These belong
// on the OUTER pressable (the thing the parent lays out); everything visual -
// background, border, padding, radius - goes on the inner animated view.
const LAYOUT_KEYS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "marginStart",
  "marginEnd",
  "alignSelf",
  "position",
  "top",
  "bottom",
  "left",
  "right",
  "zIndex",
  "aspectRatio",
]);

// A Pressable that shrinks slightly while held and springs back on release,
// so every tappable card feels physical. Drop-in for Pressable (style is a
// plain style, not a function).
export default function PressableScale({ style, pressedScale = 0.97, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();

  const { outer, inner } = useMemo(() => {
    const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    const i: Record<string, unknown> = {};
    for (const key of Object.keys(flat)) (LAYOUT_KEYS.has(key) ? o : i)[key] = flat[key];
    return { outer: o as ViewStyle, inner: i as ViewStyle };
  }, [style]);

  function to(v: number, ms: number) {
    if (reduce) return;
    Animated.timing(scale, { toValue: v, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(e) => {
        to(pressedScale, 120);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1, 180);
        onPressOut?.(e);
      }}
    >
      {/* flexGrow lets the visual box fill an outer that has a fixed height/flex. */}
      <Animated.View style={[inner, { flexGrow: 1, transform: [{ scale }] }]}>{children as React.ReactNode}</Animated.View>
    </Pressable>
  );
}
