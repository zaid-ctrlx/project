import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { useTheme } from "../context/ThemeContext";
import { buildPickMapHtml } from "../lib/pickMapHtml";
import { radius } from "../theme";

type Props = {
  initial: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
};

// Tap-to-pick India map (native): the shared Leaflet page in a WebView.
export default function LocationMapPicker({ initial, onPick }: Props) {
  const { mode, colors } = useTheme();
  // Only the *initial* position seeds the page; later taps are owned by the
  // page itself, so `initial` is intentionally frozen per mount.
  const html = useMemo(
    () => buildPickMapHtml({ dark: mode === "dark", accent: colors.primary, initial }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, colors.primary]
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "pick") onPick(msg.lat, msg.lng);
      } catch {
        // ignore malformed messages
      }
    },
    [onPick]
  );

  return (
    <View style={{ flex: 1, minHeight: 320, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.background }}>
      <WebView
        key={mode}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost" }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: colors.background }}
      />
    </View>
  );
}
