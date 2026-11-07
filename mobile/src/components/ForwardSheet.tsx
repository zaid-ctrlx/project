import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";

import { ConversationSummary, listConversations, MessageKind, sendMessage } from "../api/messages";
import { sendGroupMessage } from "../api/groups";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";

export type ForwardItem = { kind: MessageKind; body: string };

type Props = {
  visible: boolean;
  item: ForwardItem | null;
  onClose: () => void;
  // Called after the forward finishes (successfully or partly) so the screen
  // can show a note; `failed` is how many targets didn't go through.
  onDone: (sent: number, failed: number) => void;
};

function targetKey(c: ConversationSummary): string {
  return c.type === "dm" ? `dm:${c.other_user.id}` : `group:${c.group_id}`;
}

function targetName(c: ConversationSummary): string {
  return c.type === "dm" ? c.other_user.username : c.group_name;
}

// Pick one or more existing chats (DMs and groups) to forward a message to.
// The forwarded copy is sent as a normal new message flagged `forwarded`.
export default function ForwardSheet({ visible, item, onClose, onDone }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const { styles, colors } = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: "75%",
      paddingTop: spacing.md,
    },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.xl, gap: spacing.md },
    rowText: { flex: 1, fontSize: fontSize.md, color: colors.text },
    rowKind: { fontSize: fontSize.sm, color: colors.textMuted },
    status: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
    footer: { padding: spacing.xl },
  }));

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setSelected(new Set());
    setError(null);
    setLoading(true);
    listConversations()
      .then((list) => !cancelled && setConversations(list))
      .catch(() => !cancelled && setError("Couldn't load your chats."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSend() {
    if (!item || selected.size === 0) return;
    setSending(true);
    const targets = conversations.filter((c) => selected.has(targetKey(c)));
    const results = await Promise.allSettled(
      targets.map((c) =>
        c.type === "dm"
          ? sendMessage(c.other_user.id, item.body, { kind: item.kind, forwarded: true })
          : sendGroupMessage(c.group_id, item.body, { kind: item.kind, forwarded: true })
      )
    );
    setSending(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    onClose();
    onDone(results.length - failed, failed);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Forward to...</Text>
          {loading ? (
            <ActivityIndicator style={{ margin: spacing.xl }} />
          ) : error ? (
            <Text style={styles.status}>{error}</Text>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={targetKey}
              ListEmptyComponent={<Text style={styles.status}>You have no chats to forward to yet.</Text>}
              renderItem={({ item: c }) => {
                const on = selected.has(targetKey(c));
                return (
                  <Pressable style={styles.row} onPress={() => toggle(targetKey(c))}>
                    <Ionicons
                      name={on ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={on ? colors.primary : colors.textFaint}
                    />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {targetName(c)}
                    </Text>
                    <Text style={styles.rowKind}>{c.type === "dm" ? "Chat" : c.is_community ? "Community" : "Group"}</Text>
                  </Pressable>
                );
              }}
            />
          )}
          <View style={styles.footer}>
            <Button
              label={selected.size > 0 ? `Send to ${selected.size}` : "Send"}
              onPress={onSend}
              loading={sending}
              disabled={selected.size === 0}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
