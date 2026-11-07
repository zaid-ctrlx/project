import React from "react";
import { Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { getSticker } from "../stickers";

type Props = { id: string; size?: number };

// Renders one built-in sticker by id. An id this app version doesn't know
// (e.g. sent from a newer build) shows a placeholder instead of crashing.
export default function Sticker({ id, size = 120 }: Props) {
  const def = getSticker(id);
  if (!def) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: size / 2 }}>🖼️</Text>
      </View>
    );
  }
  return <SvgXml xml={def.xml} width={size} height={size} accessibilityLabel={`${def.label} sticker`} />;
}
