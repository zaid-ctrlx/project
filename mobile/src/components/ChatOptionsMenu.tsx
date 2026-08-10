import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSearch: () => void;
  onClearChat: () => void;
  // Group-only — omit for a DM's menu and the row isn't rendered.
  onAddMembers?: () => void;
};

// The ⋯ menu shared by ChatScreen and GroupChatScreen's headers. Same
// custom-sheet shape as MessagesScreen's own ⋯ menu (title, bordered
// options, Cancel) — one component instead of two near-identical copies,
// since group chat is these same three items plus "Add members".
export default function ChatOptionsMenu({ visible, onClose, onSearch, onClearChat, onAddMembers }: Props) {
  function run(action: () => void) {
    onClose();
    action();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Chat options</Text>
          {onAddMembers && (
            <Pressable
              onPress={() => run(onAddMembers)}
              style={({ pressed }) => [styles.option, styles.optionBorder, pressed && styles.optionPressed]}
            >
              <Text style={styles.optionText}>Add members</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => run(onSearch)}
            style={({ pressed }) => [styles.option, styles.optionBorder, pressed && styles.optionPressed]}
          >
            <Text style={styles.optionText}>Search</Text>
          </Pressable>
          <Pressable
            onPress={() => run(onClearChat)}
            style={({ pressed }) => [styles.option, styles.optionBorder, pressed && styles.optionPressed]}
          >
            <Text style={styles.optionText}>Clear chat</Text>
          </Pressable>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
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
  cancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
});
