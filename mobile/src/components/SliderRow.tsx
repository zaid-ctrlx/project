import React, { useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";

const THUMB = 26;
const TRACK = 6;
const HIT_HEIGHT = 44;

type Props = {
  label: string;
  /** Text shown at the right, e.g. "50 km" or "Anywhere". */
  valueText: string;
  /** Position of the thumb as an index into the filter's list of stops. */
  index: number;
  /** Number of stops (the slider snaps to `count` evenly spaced positions). */
  count: number;
  onChange: (index: number) => void;
  /** Whether the value differs from the filter's default (colours the value). */
  active?: boolean;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// A labelled, snapping slider: label on top, a track with a draggable thumb,
// and the current value at the right. Built on PanResponder (rather than a
// native slider package) so it looks and behaves the same on Expo Go, web and
// both themes. Dragging claims the gesture so the sheet's ScrollView doesn't
// scroll away underneath the thumb; tapping the track jumps to that spot.
export default function SliderRow({ label, valueText, index, count, onChange, active }: Props) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const countRef = useRef(count);
  countRef.current = count;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const startX = useRef(0);

  const { styles } = useThemedStyles((colors) => ({
    wrap: { marginBottom: spacing.lg },
    label: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, marginBottom: spacing.xs },
    row: { flexDirection: "row", alignItems: "center" },
    hit: { flex: 1, height: HIT_HEIGHT, justifyContent: "center" },
    track: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.border, marginHorizontal: THUMB / 2 },
    fill: { position: "absolute", left: THUMB / 2, height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.accent },
    thumb: {
      position: "absolute",
      top: (HIT_HEIGHT - THUMB) / 2,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.text,
      borderWidth: 3,
      borderColor: colors.surfaceElevated,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    value: { width: 92, textAlign: "right", fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
    valueActive: { color: colors.event },
  }));

  const usable = Math.max(width - THUMB, 1);
  const frac = count > 1 ? clamp(index, 0, count - 1) / (count - 1) : 0;
  const thumbLeft = frac * usable;

  function indexAt(x: number) {
    const f = clamp(x / Math.max(widthRef.current - THUMB, 1), 0, 1);
    return Math.round(f * (countRef.current - 1));
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const maxX = Math.max(widthRef.current - THUMB, 1);
        startX.current = clamp((e.nativeEvent.locationX ?? 0) - THUMB / 2, 0, maxX);
        onChangeRef.current(indexAt(startX.current));
      },
      onPanResponderMove: (_, g) => {
        const maxX = Math.max(widthRef.current - THUMB, 1);
        onChangeRef.current(indexAt(clamp(startX.current + g.dx, 0, maxX)));
      },
    })
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View
          style={styles.hit}
          onLayout={onLayout}
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: valueText }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            const step = e.nativeEvent.actionName === "increment" ? 1 : -1;
            onChange(clamp(index + step, 0, count - 1));
          }}
        >
          <View style={styles.track} pointerEvents="none" />
          <View style={[styles.fill, { width: thumbLeft }]} pointerEvents="none" />
          <View style={[styles.thumb, { left: thumbLeft }]} pointerEvents="none" />
        </View>
        <Text style={[styles.value, active && styles.valueActive]} numberOfLines={1}>
          {valueText}
        </Text>
      </View>
    </View>
  );
}
