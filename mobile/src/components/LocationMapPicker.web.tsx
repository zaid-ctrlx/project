import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { useTheme } from "../context/ThemeContext";
import { buildPickMapHtml } from "../lib/pickMapHtml";
import { radius } from "../theme";

type Props = {
  initial: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
};

// Tap-to-pick India map (web): the shared Leaflet page in an iframe.
export default function LocationMapPicker({ initial, onPick }: Props) {
  const { mode, colors } = useTheme();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const html = useMemo(
    () => buildPickMapHtml({ dark: mode === "dark", accent: colors.primary, initial }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, colors.primary]
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "pick") onPickRef.current(msg.lat, msg.lng);
      } catch {
        // ignore
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <View style={{ flex: 1, minHeight: 320, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.background }}>
      {React.createElement("iframe", {
        ref: frameRef,
        srcDoc: html,
        key: mode,
        style: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%", border: 0 },
        title: "Pick a location on the map",
      })}
    </View>
  );
}
