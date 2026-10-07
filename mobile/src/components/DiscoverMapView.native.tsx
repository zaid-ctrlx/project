import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { MapItem } from "../api/map";
import { MAP_MARKER_COLORS } from "../constants/mapMarkers";
import { useTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { buildMapHtml } from "../lib/mapHtml";
import { fontSize, radius, spacing } from "../theme";
import MapLegend from "./MapLegend";
import MapPreviewSheet from "./MapPreviewSheet";

type Props = {
  items: MapItem[];
  loading: boolean;
  error: string | null;
  selected: MapItem | null;
  onSelect: (item: MapItem) => void;
  onClose: () => void;
  onView: (item: MapItem) => void;
  busy: boolean;
};

// Native map = the shared Leaflet page inside a WebView (see lib/mapHtml.ts)
// rather than react-native-maps, which rendered blank on phones running
// Expo Go and needs a Google key on Android standalone builds.
export default function DiscoverMapView({ items, loading, error, selected, onSelect, onClose, onView, busy }: Props) {
  const { mode } = useTheme();
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, minHeight: 320, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.background },
    status: { position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, alignItems: "center" },
    statusText: {
      backgroundColor: colors.background,
      color: colors.text,
      padding: spacing.sm,
      borderRadius: radius.sm,
      fontSize: fontSize.sm,
      overflow: "hidden",
    },
  }));
  const html = useMemo(() => buildMapHtml({ dark: mode === "dark", colors: MAP_MARKER_COLORS }), [mode]);
  const webRef = useRef<WebView>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [ready, setReady] = useState(false);
  const [pageFailed, setPageFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`window.setItems(${JSON.stringify(items)});true;`);
  }, [items, ready]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(e.nativeEvent.data);
        if (msg.type === "ready") setReady(true);
        if (msg.type === "select") {
          const item = itemsRef.current.find((i) => i.id === msg.id);
          if (item) onSelect(item);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onSelect]
  );

  const notice = pageFailed
    ? "Couldn’t load the map. Check your connection."
    : error ?? (!loading && items.length === 0 ? "No in-person events or communities in this area yet." : null);

  return (
    <View style={styles.wrapper}>
      <WebView
        key={mode}
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost" }}
        onMessage={onMessage}
        onLoadStart={() => {
          setReady(false);
          setPageFailed(false);
        }}
        onError={() => setPageFailed(true)}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        nestedScrollEnabled
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: colors.background }}
      />
      {(loading || notice) && (
        <View pointerEvents="none" style={styles.status}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.statusText}>{notice}</Text>}
        </View>
      )}
      <MapLegend />
      <MapPreviewSheet item={selected} onClose={onClose} onView={onView} busy={busy} />
    </View>
  );
}
