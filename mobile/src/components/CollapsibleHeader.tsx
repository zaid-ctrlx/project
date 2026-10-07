import React, { useState } from "react";
import { Animated, LayoutChangeEvent, View } from "react-native";

type Props = {
  // From useScrollAwareHeader(): 0 = hidden, 1 = shown.
  progress: Animated.Value;
  children: React.ReactNode;
};

// Wraps content that should slide away (height + fade) when `progress`
// goes to 0. The child's natural height is measured, not hard-coded, so
// changing fonts/spacing never leaves a gap. The inner view lays out at its
// full height while the outer one clips it, which is what makes the height
// animation read as a collapse rather than a squash.
export default function CollapsibleHeader({ progress, children }: Props) {
  const [height, setHeight] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - height) > 0.5) setHeight(h);
  }

  return (
    <Animated.View
      style={{
        height: height > 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) : undefined,
        opacity: progress,
        overflow: "hidden",
      }}
    >
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}
