import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

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

// Web: the same shared Leaflet page as native, hosted in an iframe.
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "ready") setReadyTick((t) => t + 1);
        if (msg.type === "select") {
          const item = itemsRef.current.find((i) => i.id === msg.id);
          if (item) onSelect(item);
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect]);

  useEffect(() => {
    if (readyTick > 0) frameRef.current?.contentWindow?.postMessage(JSON.stringify({ type: "items", items }), "*");
  }, [items, readyTick]);

  const notice = error ?? (!loading && items.length === 0 ? "No in-person events or communities in this area yet." : null);
  return (
    <View style={styles.wrapper}>
      {React.createElement("iframe", {
        ref: frameRef,
        srcDoc: html,
        key: mode,
        style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", border: 0 },
        title: "Discover map",
      })}
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
