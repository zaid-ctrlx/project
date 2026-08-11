import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { darkColors, lightColors, ThemeColors } from "../theme";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeState | undefined>(undefined);
const STORAGE_KEY = "theme_mode";
const FADE_IN_MS = 150;
const FADE_OUT_MS = 220;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  // Same plain-AsyncStorage pattern as auth tokens (see api/storage.ts) —
  // fine for a UI preference, no encryption needed.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setMode(saved);
    });
  }, []);

  const colors = useMemo(() => (mode === "dark" ? darkColors : lightColors), [mode]);

  // The "changing animation": there's no per-view way to animate a whole
  // tree of StyleSheet-driven colors smoothly, so instead of interpolating
  // colors we flash an opaque overlay (in the *new* theme's background) to
  // full opacity, swap `mode` underneath it while the app is fully hidden,
  // then fade the overlay back out — reads as a cross-fade even though
  // nothing but opacity is actually being animated.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [overlay, setOverlay] = useState<{ visible: boolean; color: string }>({
    visible: false,
    color: lightColors.background,
  });

  function toggle() {
    const next: ThemeMode = mode === "light" ? "dark" : "light";
    const nextBackground = (next === "dark" ? darkColors : lightColors).background;
    setOverlay({ visible: true, color: nextBackground });
    Animated.timing(overlayOpacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }).start(() => {
      setMode(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
        // Preference just won't survive a restart — not worth surfacing.
      });
      Animated.timing(overlayOpacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(() => {
        setOverlay((prev) => ({ ...prev, visible: false }));
      });
    });
  }

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle }}>
      <View style={styles.fill}>
        {children}
        {overlay.visible && (
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { backgroundColor: overlay.color, opacity: overlayOpacity }]}
          />
        )}
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
