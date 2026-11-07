import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

import { useReduceMotion } from "../../hooks/useReduceMotion";

type Props = {
  children: React.ReactNode;
  // Position in a list: each step waits 70 ms longer, so items rise one
  // after another instead of all popping in at once.
  index?: number;
  style?: StyleProp<ViewStyle>;
};

// Fades in while sliding up ~16px. Runs once when first mounted.
export default function FadeInUp({ children, index = 0, style }: Props) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, reduce, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
