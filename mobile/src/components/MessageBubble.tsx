import React from "react";
import { Pressable, Text, View } from "react-native";

import type { MessageExtras } from "../api/messages";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import EventShareCard from "./EventShareCard";
import Sticker from "./Sticker";

// The fields of a DM or group message that the bubble needs.
export type BubbleMessage = MessageExtras & {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Props = {
  message: BubbleMessage;
  mine: boolean;
  // Group chats show who sent it; DMs don't need to.
  senderName?: string;
  // Resolves a quote's sender id to a display name ("You", a username...).
  quoteName: (senderId: string | null) => string;
  myId: string | undefined;
  onLongPress: () => void;
  onQuotePress?: () => void;
  onReactionPress: (emoji: string) => void;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessageBubble({
  message,
  mine,
  senderName,
  quoteName,
  myId,
  onLongPress,
  onQuotePress,
  onReactionPress,
}: Props) {
  const { styles } = useThemedStyles((colors) => ({
    row: { marginVertical: spacing.xs, maxWidth: "80%" },
    rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    rowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
    bubble: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    bubbleMine: { backgroundColor: colors.primary },
    bubbleTheirs: { backgroundColor: colors.chipBackground },
    // Stickers and tombstones-in-a-bubble differ: stickers sit bare on the
    // page, like WhatsApp.
    stickerWrap: { paddingVertical: spacing.xs },
    senderName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary, marginBottom: 2 },
    text: { fontSize: fontSize.base, color: colors.text },
    textMine: { color: colors.primaryText },
    deleted: { fontSize: fontSize.base, fontStyle: "italic", color: colors.textMuted },
    deletedMine: { color: colors.primaryText, opacity: 0.8 },
    forwarded: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
    forwardedText: { fontSize: fontSize.sm, fontStyle: "italic", color: colors.textMuted },
    forwardedTextMine: { color: colors.primaryText, opacity: 0.8 },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: "rgba(0,0,0,0.08)",
      borderRadius: radius.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.xs,
    },
    quoteName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.accent },
    quoteText: { fontSize: fontSize.sm, color: colors.textMuted },
    quoteTextMine: { color: colors.primaryText, opacity: 0.85 },
    meta: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs, gap: spacing.xs },
    metaText: { fontSize: fontSize.sm, color: colors.textFaint },
    reactions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
    reactionChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    reactionChipMine: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: 3 },
  }));

  const deleted = !!message.deleted_at;
  const isSticker = message.kind === "sticker" && !deleted;
  const isEventCard = message.kind === "event" && !deleted;
  const hasQuote = !!message.quote_text && !deleted;

  // emoji -> { count, reactedByMe }, in first-seen order.
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of message.reactions ?? []) {
    const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
    g.count += 1;
    g.mine = g.mine || r.user_id === myId;
    grouped.set(r.emoji, g);
  }

  const content = (
    <>
      {senderName && !mine && <Text style={styles.senderName}>{senderName}</Text>}
      {message.forwarded && !deleted && (
        <View style={styles.forwarded}>
          <Text style={[styles.forwardedText, mine && !isSticker && styles.forwardedTextMine]}>↪ Forwarded</Text>
        </View>
      )}
      {hasQuote && (
        <Pressable onPress={onQuotePress} disabled={!onQuotePress}>
          <View style={styles.quote}>
            <Text style={styles.quoteName} numberOfLines={1}>
              {quoteName(message.quote_sender_id)}
            </Text>
            <Text style={[styles.quoteText, mine && !isSticker && styles.quoteTextMine]} numberOfLines={2}>
              {message.quote_kind === "sticker" ? "Sticker" : message.quote_kind === "event" ? "Event" : message.quote_text}
            </Text>
          </View>
        </Pressable>
      )}
      {deleted ? (
        <Text style={[styles.deleted, mine && styles.deletedMine]}>This message was deleted</Text>
      ) : isEventCard ? (
        <EventShareCard eventId={message.body} />
      ) : isSticker ? (
        <Sticker id={message.body} size={110} />
      ) : (
        <Text style={[styles.text, mine && styles.textMine]}>{message.body}</Text>
      )}
    </>
  );

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable onLongPress={onLongPress} delayLongPress={250}>
        {isSticker ? (
          <View style={styles.stickerWrap}>{content}</View>
        ) : (
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>{content}</View>
        )}
      </Pressable>
      {grouped.size > 0 && (
        <View style={styles.reactions}>
          {[...grouped.entries()].map(([emoji, g]) => (
            <Pressable
              key={emoji}
              onPress={() => onReactionPress(emoji)}
              style={[styles.reactionChip, g.mine && styles.reactionChipMine]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {g.count > 1 && <Text style={styles.reactionCount}>{g.count}</Text>}
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.meta}>
        {message.edited_at && !deleted && <Text style={styles.metaText}>edited</Text>}
        <Text style={styles.metaText}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
}
