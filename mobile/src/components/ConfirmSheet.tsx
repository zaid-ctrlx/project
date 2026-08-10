import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  // Disables both buttons and swaps the confirm label to "<label>..." (or
  // busyLabel, if given) while an action from onConfirm is in flight.
  busy?: boolean;
  busyLabel?: string;
};

// A destructive yes/no prompt — same custom-Modal-sheet pattern used
// throughout this app (ProfileForm's avatar-source picker, MessagesScreen's
// ⋯ menu) instead of Alert.alert, which RN Web doesn't render with more
// than one interactive button. Pulled out once a third call site (Clear
// Chat, on top of Remove from group) needed the identical shape.
export default function ConfirmSheet({ visible, onClose, title, body, confirmLabel, onConfirm, busy, busyLabel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {body && <Text style={styles.body}>{body}</Text>}
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            style={({ pressed }) => [styles.option, styles.optionBorder, pressed && styles.optionPressed]}
          >
            <Text style={styles.destructiveText}>{busy ? (busyLabel ?? `${confirmLabel}...`) : confirmLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  option: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optionPressed: { backgroundColor: colors.chipBackground },
  destructiveText: { fontSize: fontSize.md, color: colors.danger, fontWeight: "600", textAlign: "center" },
  cancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
});
