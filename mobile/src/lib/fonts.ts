import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { StyleSheet, Text } from "react-native";

// Plus Jakarta Sans is the design system's only typeface. Custom fonts on
// native are one file per weight, so `fontWeight` has to be translated to a
// family name; applyGlobalFont() does that once for every <Text>/<TextInput>
// so existing screens (which only set fontWeight) pick the font up without
// per-file changes.
export const FONT_ASSETS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

function familyFor(weight: unknown): string {
  switch (String(weight ?? "400")) {
    case "500":
      return "PlusJakartaSans_500Medium";
    case "600":
      return "PlusJakartaSans_600SemiBold";
    case "700":
    case "bold":
      return "PlusJakartaSans_700Bold";
    case "800":
    case "900":
      return "PlusJakartaSans_800ExtraBold";
    default:
      return "PlusJakartaSans_400Regular";
  }
}

let applied = false;

export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;
  // Only <Text> is patched. TextInput is deliberately left alone: re-wrapping
  // its props on every render is risky for focus handling on native, so
  // TextField sets the font family on its own inputs instead.
  for (const Component of [Text] as any[]) {
    const originalRender = Component.render;
    if (typeof originalRender !== "function") continue;
    Component.render = function patchedRender(props: any, ref: any) {
      const flat = (StyleSheet.flatten(props.style) as any) ?? {};
      if (flat.fontFamily) return originalRender.call(this, props, ref);
      return originalRender.call(
        this,
        { ...props, style: [props.style, { fontFamily: familyFor(flat.fontWeight), fontWeight: "normal" }] },
        ref
      );
    };
  }
}

export const FONT_REGULAR = "PlusJakartaSans_400Regular";
export const FONT_BOLD = "PlusJakartaSans_700Bold";
export const FONT_EXTRABOLD = "PlusJakartaSans_800ExtraBold";
