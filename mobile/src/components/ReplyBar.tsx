import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = {
  name: string;
  text: string;
  // "Replying privately to ..." when answering a group message in a DM.
  privateReply?: boolean;
  onCancel: () => void;
};

// The strip above the composer showing which message is being replied to.
export default function ReplyBar({ name, text, privateReply, onCancel }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.chipBackground,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      borderRadius: radius.sm,
    },
    body: { flex: 1 },
    name: { fontSize: fontSize.sm, fontWeight: "700", color: colors.accent },
    text: { fontSize: fontSize.sm, color: colors.textMuted },
  }));

  return (
    <View style={styles.bar}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {privateReply ? `Replying privately to ${name}` : `Replying to ${name}`}
        </Text>
        <Text style={styles.text} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Cancel reply">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
