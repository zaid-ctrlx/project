import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Drop-in replacement for react-native-safe-area-context's hook. On Android
// (Expo Go, edge-to-edge) the reported top inset can come back as 0 before
// the native side has measured — which slides each screen's title row under
// the status bar, so the top of the screen looks cut off on a real phone
// while the web preview (which has no status bar) looks fine. Falling back
// to the status bar's own height guarantees we never draw under it.
export function useSafeInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "android") return insets;
  return { ...insets, top: Math.max(insets.top, StatusBar.currentHeight ?? 0) };
}
