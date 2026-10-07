import { useCallback, useMemo, useRef } from "react";
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// Distance (px) the finger has to keep moving in one direction before the
// header flips state — filters out jitter and tiny accidental drags.
const DIRECTION_THRESHOLD = 14;
const ANIMATION_MS = 200;

export type ScrollAwareHeader = {
  // 0 = fully hidden, 1 = fully shown. Drives <CollapsibleHeader progress=...>.
  progress: Animated.Value;
  // Pass to a scrollable's onScroll (with scrollEventThrottle={16}). `listId`
  // keeps separate scroll positions for screens that host several lists
  // (e.g. Discover's pager), so switching between them never produces a
  // bogus delta.
  onScroll: (listId?: string) => (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  show: () => void;
  hide: () => void;
};

// Direction-based (not position-based) header visibility:
//  - scrolling the content *down* the list (finger swipes up)  -> hide
//  - scrolling back *up* the list (finger swipes down)         -> reveal
//  - at the very top (including iOS overscroll)                -> always shown
//  - lists too short to meaningfully scroll never hide it
// Visibility animates between the two states instead of tracking the finger
// pixel-for-pixel.
export function useScrollAwareHeader(): ScrollAwareHeader {
  const progress = useRef(new Animated.Value(1)).current;
  const visibleRef = useRef(true);
  const lastY = useRef<Record<string, number>>({});
  const accum = useRef(0);

  const animateTo = useCallback(
    (visible: boolean) => {
      if (visibleRef.current === visible) return;
      visibleRef.current = visible;
      Animated.timing(progress, {
        toValue: visible ? 1 : 0,
        duration: ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animates layout height
      }).start();
    },
    [progress]
  );

  const show = useCallback(() => {
    accum.current = 0;
    animateTo(true);
  }, [animateTo]);
  const hide = useCallback(() => animateTo(false), [animateTo]);

  const onScroll = useCallback(
    (listId = "default") =>
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        const y = contentOffset.y;
        const prev = lastY.current[listId] ?? 0;
        lastY.current[listId] = y;
        const delta = y - prev;

        // At/above the top (also covers iOS bounce): always visible.
        if (y <= 0) {
          show();
          return;
        }
        // Don't hide anything on lists that barely scroll — it would just
        // make the content jump.
        if (contentSize.height - layoutMeasurement.height < 120) {
          show();
          return;
        }
        // Ignore the rubber-band at the bottom edge.
        if (y + layoutMeasurement.height >= contentSize.height) return;
        if (delta === 0) return;

        // Accumulate movement in a single direction; reset when it flips.
        if (Math.sign(delta) !== Math.sign(accum.current)) accum.current = 0;
        accum.current += delta;

        if (accum.current > DIRECTION_THRESHOLD) animateTo(false);
        else if (accum.current < -DIRECTION_THRESHOLD) animateTo(true);
      },
    [animateTo, show]
  );

  return useMemo(() => ({ progress, onScroll, show, hide }), [progress, onScroll, show, hide]);
}
