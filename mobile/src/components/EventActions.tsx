import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Event } from "../api/events";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";
import ForwardSheet from "./ForwardSheet";

// "Share in chat" (sends a card into 1-on-1 chats only) and, when the
// organiser allows it, "Message organiser" (opens a 1-on-1 chat with them).
export default function EventActions({ event }: { event: Event }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const isCreator = event.creator.id === user?.id;
  const { styles, colors } = useThemedStyles((colors) => ({
    row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    btn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    text: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
    note: { textAlign: "center", marginTop: spacing.xs, fontSize: fontSize.sm, color: colors.textMuted },
  }));

  return (
    <View>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => setShareOpen(true)} accessibilityRole="button">
          <Ionicons name="paper-plane-outline" size={16} color={colors.text} />
          <Text style={styles.text}>Share in chat</Text>
        </Pressable>
        {!isCreator && event.allow_dms && (
          <Pressable
            style={styles.btn}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("Chat", {
                userId: event.creator.id,
                username: event.creator.username,
                avatarUrl: event.creator.avatar_url,
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={16} color={colors.text} />
            <Text style={styles.text}>Message organiser</Text>
          </Pressable>
        )}
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      <ForwardSheet
        visible={shareOpen}
        item={{ kind: "event", body: event.id }}
        title="Share with..."
        onClose={() => setShareOpen(false)}
        onDone={(sent, failed) => {
          setNote(failed ? `Shared with ${sent}, ${failed} failed` : `Shared with ${sent} chat${sent === 1 ? "" : "s"}`);
          setTimeout(() => setNote(null), 2500);
        }}
      />
    </View>
  );
}
