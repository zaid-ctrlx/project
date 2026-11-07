import React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { STICKERS } from "../stickers";
import { spacing } from "../theme";
import Sticker from "./Sticker";

type Props = { onPick: (stickerId: string) => void };

// The built-in sticker grid, shown in place of the keyboard area above the
// composer. Tapping a sticker sends it straight away.
export default function StickerPanel({ onPick }: Props) {
  const { styles } = useThemedStyles((colors) => ({
    panel: { height: 230, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.background },
    grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.sm },
    cell: { width: "25%", alignItems: "center", paddingVertical: spacing.sm },
    cellPressed: { opacity: 0.5 },
  }));

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.grid}>
        {STICKERS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onPick(s.id)}
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
            accessibilityLabel={`Send ${s.label} sticker`}
          >
            <Sticker id={s.id} size={64} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
