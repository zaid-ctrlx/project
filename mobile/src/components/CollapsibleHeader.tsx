import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, View } from "react-native";

import { reportHeaderHeight } from "../hooks/useScrollAwareHeader";

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
  const key = useRef(Symbol("collapsible-header")).current;

  useEffect(() => {
    reportHeaderHeight(progress, key, height);
    return () => reportHeaderHeight(progress, key, null);
  }, [progress, key, height]);

  // Track how expanded the header is so a measurement taken while it is
  // collapsing/collapsed can never overwrite the stored full height (a too-small
  // stored height would make the header re-open to the wrong size, or not at all).
  const fullyShown = useRef(true);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      fullyShown.current = value >= 0.99;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  function onLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - height) > 0.5 && (fullyShown.current || height === 0)) setHeight(h);
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
