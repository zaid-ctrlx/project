import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useColorScheme, View } from "react-native";

import { darkColors, lightColors, ThemeColors } from "../theme";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);
const STORAGE_KEY = "theme_mode";
const FADE_OUT_MS = 260;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Follows the phone's light/dark setting by default. Toggling it (Settings >
  // Dark mode) stores an explicit choice, which then wins over the system.
  const system: ThemeMode = useColorScheme() === "dark" ? "dark" : "light";
  const [override, setOverride] = useState<ThemeMode | null>(null);
  const mode: ThemeMode = override ?? system;
  // Plain AsyncStorage is fine for a UI preference (no secrets).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setOverride(saved);
    });
  }, []);

  const colors = useMemo(() => (mode === "dark" ? darkColors : lightColors), [mode]);

  // Switching theme re-renders every mounted screen, which blocks the JS thread
  // for a moment. To keep that invisible and the tap feeling instant:
  //   1. a full-screen cover in the NEW theme's background snaps to opaque
  //      right away (no waiting for a fade-in first),
  //   2. only then is the theme swapped underneath it,
  //   3. once React has finished re-rendering, the cover fades out - the
  //      content "arrives" already in the new theme.
  // The cover is always mounted (just transparent) so showing it needs no React
  // render, and the context value below is memoised so changing the cover's
  // colour never re-renders the whole app.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [overlayColor, setOverlayColor] = useState(darkColors.background);
  const busy = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const toggle = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    const next: ThemeMode = modeRef.current === "light" ? "dark" : "light";
    setOverlayColor((next === "dark" ? darkColors : lightColors).background);
    // Let the cover's new colour paint, snap it opaque, then swap the theme.
    requestAnimationFrame(() => {
      overlayOpacity.setValue(1);
      requestAnimationFrame(() => {
        setOverride(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
          // Preference just won't survive a restart - not worth surfacing.
        });
        // These callbacks run only after React has committed the re-render.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            Animated.timing(overlayOpacity, {
              toValue: 0,
              duration: FADE_OUT_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start(() => {
              busy.current = false;
            });
          })
        );
      });
    });
  }, [overlayOpacity]);

  const value = useMemo(() => ({ mode, colors, toggle }), [mode, colors, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: overlayColor, opacity: overlayOpacity }]}
        />
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
