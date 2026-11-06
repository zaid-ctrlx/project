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
// Brand palette — four colours, everything else is a tint or shade of them:
//   Deep Navy        #24213F  ink in light mode, the base of dark mode
//   Electric Violet  #7565F5  primary actions, communities
//   Adventure Orange #FF824D  events, highlights
//   Warm Cream       #F5F3EF  paper in light mode, ink in dark mode
// Light mode keeps the cream as-is; dark mode flips it — navy becomes the
// page and cream becomes the text — so both feel like the same product.
//
// Each colour has its own job so all four show up, instead of violet doing
// everything:
//   violet  -> actions: primary buttons, links, your own chat bubbles
//   orange  -> attention: active tab, badges, events, slider, highlights
//   navy    -> structure: the tab bar, selected chips/segments ("inverse")
//   cream   -> paper and the text that sits on navy
export const lightColors = {
  background: "#F5F3EF",
  text: "#24213F",
  textMuted: "#5D5A73",
  textFaint: "#9A97A8",
  border: "#E2DDD4",
  borderLight: "#ECE8E1",
  primary: "#7565F5",
  primaryText: "#FFFFFF",
  danger: "#C4453A",
  success: "#2F8A5F",
  chipBackground: "#ECE8E1",
  // Extended tokens
  surface: "#FCFBF8",
  surfaceElevated: "#EFEBE4",
  secondary: "#FF824D",
  primarySoft: "rgba(117,101,245,0.10)",
  successSoft: "rgba(47,138,95,0.10)",
  glow: "rgba(36,33,63,0.10)",
  scrim: "rgba(36,33,63,0.45)",
  // Events are orange and communities violet, so the two read differently
  // at a glance (see EventCard / map markers).
  community: "#7565F5",
  communitySoft: "rgba(117,101,245,0.10)",
  event: "#E8693A",
  eventSoft: "rgba(255,130,77,0.12)",
  // Orange as a fill (badges, active tab, slider) with navy text on top —
  // navy on orange reads better than white on orange.
  accent: "#FF824D",
  accentText: "#24213F",
  accentSoft: "rgba(255,130,77,0.14)",
  // Selected chips/segments: solid navy with cream text in light mode,
  // flipped to cream with navy text in dark mode.
  inverse: "#24213F",
  inverseText: "#F5F3EF",
  // Bottom tab bar is navy in both modes.
  tabBar: "#24213F",
  tabBarInactive: "rgba(245,243,239,0.55)",
};

export const darkColors: typeof lightColors = {
  background: "#16142A",
  text: "#F5F3EF",
  textMuted: "#B3AFC4",
  textFaint: "#76728C",
  border: "#34304F",
  borderLight: "#24213F",
  primary: "#8576FF",
  primaryText: "#FFFFFF",
  danger: "#FF7B6E",
  success: "#5CC795",
  chipBackground: "#2A2745",
  surface: "#1E1B36",
  surfaceElevated: "#28254A",
  secondary: "#FF824D",
  primarySoft: "rgba(133,118,255,0.16)",
  successSoft: "rgba(92,199,149,0.14)",
  glow: "rgba(0,0,0,0.35)",
  scrim: "rgba(12,11,24,0.65)",
  community: "#9A8DFF",
  communitySoft: "rgba(154,141,255,0.14)",
  event: "#FF824D",
  eventSoft: "rgba(255,130,77,0.14)",
  accent: "#FF824D",
  accentText: "#24213F",
  accentSoft: "rgba(255,130,77,0.16)",
  inverse: "#F5F3EF",
  inverseText: "#24213F",
  tabBar: "#0F0D1F",
  tabBarInactive: "rgba(245,243,239,0.5)",
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
