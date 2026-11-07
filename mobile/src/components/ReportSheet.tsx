import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

import { ApiError } from "../api/client";
import { REPORT_REASON_LABELS, ReportReason, ReportTarget, submitReport } from "../api/reports";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  // Shown in the heading, e.g. a username or event title.
  targetName: string;
};

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

// Report a user or a post. Reasons are a fixed list (so moderators can triage
// them) plus an optional note. Reporting is private: the reported person is
// never told who reported them. Same custom-Modal pattern as ConfirmSheet.
export default function ReportSheet({ visible, onClose, targetType, targetId, targetName }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Fresh form every time it opens.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails("");
      setBusy(false);
      setError(null);
      setDone(false);
    }
  }, [visible]);

  const { styles, colors } = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    sheet: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: "hidden",
      paddingVertical: spacing.md,
    },
    title: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, textAlign: "center", paddingHorizontal: spacing.lg },
    sub: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
    reason: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    reasonPressed: { backgroundColor: colors.chipBackground },
    reasonText: { fontSize: fontSize.base, color: colors.text, flex: 1 },
    input: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      minHeight: 64,
      color: colors.text,
      fontSize: fontSize.base,
      textAlignVertical: "top",
    },
    error: { color: colors.danger, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.lg },
    actions: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: spacing.md },
    action: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    actionPressed: { backgroundColor: colors.chipBackground },
    submit: { fontSize: fontSize.md, color: colors.danger, fontWeight: "600", textAlign: "center" },
    submitDisabled: { color: colors.textFaint },
    cancel: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
    doneIcon: { alignSelf: "center", marginTop: spacing.md },
  }));

  async function onSubmit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport(targetType, targetId, reason, details);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {done ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={44} color={colors.success} style={styles.doneIcon} />
                <Text style={[styles.title, { marginTop: spacing.sm }]}>Thanks for letting us know</Text>
                <Text style={styles.sub}>
                  Your report is private - {targetType === "user" ? "they" : "the organiser"} won't be told it was you.
                  You can also block {targetType === "user" ? "them" : "organisers"} to stop seeing their activity.
                </Text>
                <View style={styles.actions}>
                  <Pressable onPress={onClose} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
                    <Text style={styles.cancel}>Done</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Report {targetName}</Text>
                <Text style={styles.sub}>What's wrong? Reports are private.</Text>
                {REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={({ pressed }) => [styles.reason, pressed && styles.reasonPressed]}
                  >
                    <Ionicons
                      name={reason === r ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={reason === r ? colors.primary : colors.textFaint}
                    />
                    <Text style={styles.reasonText}>{REPORT_REASON_LABELS[r]}</Text>
                  </Pressable>
                ))}
                {reason && (
                  <TextInput
                    style={styles.input}
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Add details (optional)"
                    placeholderTextColor={colors.textFaint}
                    multiline
                    maxLength={500}
                  />
                )}
                {error && <Text style={styles.error}>{error}</Text>}
                <View style={styles.actions}>
                  <Pressable
                    onPress={onSubmit}
                    disabled={!reason || busy}
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  >
                    <Text style={[styles.submit, (!reason || busy) && styles.submitDisabled]}>
                      {busy ? "Sending..." : "Send report"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onClose}
                    disabled={busy}
                    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                  >
                    <Text style={styles.cancel}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
