import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import TextField from "./TextField";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
};

const CONFIRM_WORD = "CONFIRM";

// The heavier sibling of ConfirmSheet — for actions that don't just affect
// the current user (deleting a whole group/community takes other members'
// chat history and membership with it), a single tap is too cheap a
// safeguard. Same warning-block + typed-confirmation shape as
// DeleteAccountScreen, condensed into a modal since this doesn't need its
// own full screen. The confirm button stays disabled until the typed text
// exactly matches "CONFIRM".
export default function ConfirmDeleteSheet({ visible, onClose, title, body, confirmLabel, onConfirm, busy }: Props) {
  const [input, setInput] = useState("");

  // Reset each time the sheet (re)opens so a leftover "CONFIRM" from a
  // previous open can't silently pre-arm the button.
  useEffect(() => {
    if (visible) setInput("");
  }, [visible]);

  const canConfirm = input.trim() === CONFIRM_WORD;

  const { styles, colors } = useThemedStyles((colors) => ({
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
      padding: spacing.lg,
      gap: spacing.md,
    },
    title: { fontSize: fontSize.md, fontWeight: "700", color: colors.danger, textAlign: "center" },
    body: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
    hint: { fontSize: fontSize.sm, color: colors.textFaint, textAlign: "center" },
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps so they don't fall through to the backdrop and
            dismiss the sheet while typing. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Text style={styles.hint}>Type CONFIRM to continue</Text>
          <TextField
            placeholder="CONFIRM"
            autoCapitalize="characters"
            autoCorrect={false}
            value={input}
            onChangeText={setInput}
          />
          <Button label={confirmLabel} onPress={onConfirm} loading={busy} disabled={!canConfirm} danger />
          <Button label="Cancel" variant="text" onPress={onClose} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
