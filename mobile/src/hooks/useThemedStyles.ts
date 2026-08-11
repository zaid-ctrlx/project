import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "../context/ThemeContext";
import type { ThemeColors } from "../theme";

// Every screen/component used to define its StyleSheet.create({...}) once,
// at module scope, against a static `colors` import — cheap, but baked the
// palette in permanently. Now that colors are dynamic (see ThemeContext),
// that has to happen at render time and rerun when the theme changes; this
// hook is the one place that does both (StyleSheet.create + the current
// colors) so call sites need one import/hook instead of two. Returns
// `colors` too since a few screens reach for it outside the styles object
// (e.g. an icon's `color` prop).
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T
): { styles: T; colors: ThemeColors } {
  const { colors } = useTheme();
  // factory is a fresh function every render (defined inline at each call
  // site) — deliberately not a dep, only `colors` actually needs to
  // retrigger StyleSheet.create.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const styles = useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  return { styles, colors };
}
