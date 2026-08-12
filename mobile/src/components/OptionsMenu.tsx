import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

export type OptionsMenuItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  // Visible but inert — "not built yet", distinct from not showing the row
  // at all. Renders greyed out and ignores taps.
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  // Empty array renders as just title + Cancel — a valid "nothing here yet"
  // state, not an error.
  items: OptionsMenuItem[];
};

// Generic ⋯ menu sheet: title + options + Cancel, same custom-Modal shape
// used throughout this app (ProfileForm's avatar picker, ChatOptionsMenu,
// MessagesScreen's own ⋯ menu) instead of Alert.alert, which RN Web won't
// render with more than one interactive button. Kept separate from
// ChatOptionsMenu — that one's props are shaped specifically around chat's
// fixed Search/Clear/Add-members actions; this one takes a plain items
// array for menus anywhere else, including ones not fully decided yet.
export default function OptionsMenu({ visible, onClose, title, items }: Props) {
  const { styles } = useThemedStyles((colors) => ({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: "hidden",
      paddingVertical: spacing.sm,
    },
    title: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    option: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    optionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    optionPressed: { backgroundColor: colors.chipBackground },
    optionText: { fontSize: fontSize.md, color: colors.text, textAlign: "center" },
    optionTextDestructive: { color: colors.danger },
    optionTextDisabled: { color: colors.textFaint },
    cancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
  }));

  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          {title && <Text style={styles.title}>{title}</Text>}
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => run(item.onPress)}
              disabled={item.disabled}
              style={({ pressed }) => [
                styles.option,
                styles.optionBorder,
                pressed && !item.disabled && styles.optionPressed,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  item.destructive && styles.optionTextDestructive,
                  item.disabled && styles.optionTextDisabled,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
