// Shared design tokens. Every screen should pull from here instead of
// hardcoding colors/spacing/radii — keeps things visually consistent
// without needing a full design system yet.
//
// Colors are no longer a single static palette — see ThemeContext, which
// picks one of the two below and hands it out dynamically (through
// useThemedStyles/useTheme) so the whole app can flip light/dark at
// runtime. There's deliberately no plain `colors` export anymore: every
// screen/component must go through the theme hooks, and removing the
// static export is what makes `tsc` catch any file that still imports one
// directly instead of migrating.
// Huddle palette: warm orange accent on near-black ("ember" look), with
// amber as the secondary accent and emerald kept for success/"going".
// Dark is the primary look; the light palette is a matching, warm variant.
export const lightColors = {
  background: "#fbf7f3",
  text: "#1a1411",
  textMuted: "#6a5f58",
  textFaint: "#9a8f87",
  border: "#e6dcd3",
  borderLight: "#f0e8e0",
  primary: "#e8590c",
  primaryText: "#ffffff",
  danger: "#d92d20",
  success: "#13a45a",
  chipBackground: "#f1e8df",
  // Extended tokens
  surface: "#ffffff",
  surfaceElevated: "#f5ece3",
  secondary: "#d98300",
  primarySoft: "rgba(232,89,12,0.12)",
  successSoft: "rgba(19,164,90,0.12)",
  glow: "rgba(232,89,12,0.25)",
  scrim: "rgba(26,20,17,0.55)",
};

export const darkColors: typeof lightColors = {
  background: "#0a0a0a",
  text: "#faf6f1",
  textMuted: "#a8a09a",
  textFaint: "#6e665f",
  border: "#2a2623",
  borderLight: "#1c1917",
  primary: "#ff6a1a",
  primaryText: "#140a03",
  danger: "#ff6b6b",
  success: "#32D583",
  chipBackground: "#1f1b18",
  surface: "#141210",
  surfaceElevated: "#1d1916",
  secondary: "#ffb020",
  primarySoft: "rgba(255,106,26,0.16)",
  successSoft: "rgba(50,213,131,0.12)",
  glow: "rgba(255,106,26,0.4)",
  scrim: "rgba(10,10,10,0.7)",
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const fontSize = {
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};
