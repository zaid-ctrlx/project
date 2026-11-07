import React, { useRef } from "react";
import { Animated, Easing, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

import { useReduceMotion } from "../../hooks/useReduceMotion";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  // How far it shrinks while held (1 = no shrink).
  pressedScale?: number;
};

// A Pressable that shrinks slightly while held and springs back on release,
// so every tappable card feels physical. Drop-in for Pressable (style is a
// plain style, not a function).
export default function PressableScale({ style, pressedScale = 0.97, children, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();

  function to(v: number, ms: number) {
    if (reduce) return;
    Animated.timing(scale, { toValue: v, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        to(pressedScale, 120);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1, 180);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children as React.ReactNode}</Animated.View>
    </Pressable>
  );
}
