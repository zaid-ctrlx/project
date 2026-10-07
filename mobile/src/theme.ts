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
// "Nocturne Social" palette (see the Huddle UI design system): deep
// slate canvas, electric violet/blue accents, emerald for success/"going".
// Dark is the primary look; the light palette is a matching, calmer variant.
export const lightColors = {
  background: "#f6f6fb",
  text: "#14151c",
  textMuted: "#5b6070",
  textFaint: "#8b90a0",
  border: "#dcdce8",
  borderLight: "#e9e9f2",
  primary: "#6b47f5",
  primaryText: "#ffffff",
  danger: "#d92d20",
  success: "#13a45a",
  chipBackground: "#ececf6",
  // Extended tokens
  surface: "#ffffff",
  surfaceElevated: "#f0f0f8",
  secondary: "#2b7fe0",
  primarySoft: "rgba(107,71,245,0.12)",
  successSoft: "rgba(19,164,90,0.12)",
  glow: "rgba(107,71,245,0.25)",
  scrim: "rgba(20,21,28,0.55)",
};

export const darkColors: typeof lightColors = {
  background: "#08090D",
  text: "#F4F5F8",
  textMuted: "#9CA3AF",
  textFaint: "#626978",
  border: "#242832",
  borderLight: "#1a1d26",
  primary: "#7C5CFF",
  primaryText: "#FFFFFF",
  danger: "#ff6b6b",
  success: "#32D583",
  chipBackground: "#191D26",
  surface: "#13161D",
  surfaceElevated: "#191D26",
  secondary: "#4DA3FF",
  primarySoft: "rgba(124,92,255,0.16)",
  successSoft: "rgba(50,213,131,0.12)",
  glow: "rgba(124,92,255,0.35)",
  scrim: "rgba(8,9,13,0.7)",
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
