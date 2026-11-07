import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type Action = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean };

type Props = {
  visible: boolean;
  onClose: () => void;
  // Emoji I've already reacted with, highlighted in the reaction bar.
  myReaction: string | null;
  onReact: (emoji: string) => void;
  // Each action is only shown when its handler is provided, so the screen
  // decides what applies (e.g. no Edit after 5 minutes, no Copy on a sticker).
  onReply?: () => void;
  onReplyPrivately?: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  // When false (a deleted message) only the actions that still make sense
  // are passed in, and the reaction bar is hidden.
  allowReactions?: boolean;
};

// Long-press menu for a message: a reaction bar on top, then the actions.
export default function MessageActionSheet({
  visible,
  onClose,
  myReaction,
  onReact,
  onReply,
  onReplyPrivately,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  allowReactions = true,
}: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    column: { width: "100%", maxWidth: 360, gap: spacing.md },
    reactionBar: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: colors.background,
      borderRadius: 30,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    reactionButton: { padding: spacing.xs, borderRadius: 20 },
    reactionButtonActive: { backgroundColor: colors.primarySoft },
    reactionEmoji: { fontSize: 28 },
    sheet: { backgroundColor: colors.background, borderRadius: radius.md, overflow: "hidden" },
    action: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    actionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    actionPressed: { backgroundColor: colors.chipBackground },
    actionText: { fontSize: fontSize.md, color: colors.text },
    dangerText: { color: colors.danger },
  }));

  const actions: Action[] = [];
  const add = (key: string, label: string, icon: Action["icon"], fn?: () => void, danger?: boolean) => {
    if (fn) actions.push({ key, label, icon, onPress: fn, danger });
  };
  add("reply", "Reply", "arrow-undo-outline", onReply);
  add("private", "Reply privately", "person-outline", onReplyPrivately);
  add("copy", "Copy", "copy-outline", onCopy);
  add("forward", "Forward", "arrow-redo-outline", onForward);
  add("edit", "Edit", "create-outline", onEdit);
  add("delete", "Delete", "trash-outline", onDelete, true);

  // Close first, then run the action, so an action that opens another modal
  // (forward, edit) isn't fighting this one for the screen.
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.column}>
          {allowReactions && (
            <View style={styles.reactionBar}>
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={run(() => onReact(emoji))}
                  style={[styles.reactionButton, myReaction === emoji && styles.reactionButtonActive]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {actions.length > 0 && (
            <View style={styles.sheet}>
              {actions.map((a, i) => (
                <Pressable
                  key={a.key}
                  onPress={run(a.onPress)}
                  style={({ pressed }) => [styles.action, i < actions.length - 1 && styles.actionBorder, pressed && styles.actionPressed]}
                >
                  <Ionicons name={a.icon} size={20} color={a.danger ? colors.danger : colors.text} />
                  <Text style={[styles.actionText, a.danger && styles.dangerText]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
