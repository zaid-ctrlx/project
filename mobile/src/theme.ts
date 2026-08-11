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
export const lightColors = {
  background: "#ffffff",
  text: "#111111",
  textMuted: "#666666",
  textFaint: "#999999",
  border: "#d9d9d9",
  borderLight: "#eeeeee",
  primary: "#111111",
  primaryText: "#ffffff",
  danger: "#cc0000",
  success: "#0a8a0a",
  chipBackground: "#f4f4f5",
};

export const darkColors: typeof lightColors = {
  background: "#0f0f10",
  text: "#f2f2f2",
  textMuted: "#a3a3a3",
  textFaint: "#737373",
  border: "#3a3a3c",
  borderLight: "#242426",
  primary: "#f2f2f2",
  primaryText: "#111111",
  danger: "#ff6b6b",
  success: "#4ade80",
  chipBackground: "#1c1c1e",
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
