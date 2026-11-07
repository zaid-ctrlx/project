import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import {
  canEditMessage,
  clearDmChat,
  deleteMessage,
  editMessage,
  getThread,
  Message,
  reactToMessage,
  sendMessage,
} from "../api/messages";
import Button from "../components/Button";
import ConfirmSheet from "../components/ConfirmSheet";
import ForwardSheet, { ForwardItem } from "../components/ForwardSheet";
import MessageActionSheet from "../components/MessageActionSheet";
import MessageBubble from "../components/MessageBubble";
import ReplyBar from "../components/ReplyBar";
import SearchField from "../components/SearchField";
import StickerPanel from "../components/StickerPanel";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useMessaging } from "../context/MessagingContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { filterMessagesByText } from "../lib/chatSearch";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

const PAGE_SIZE = 30;

export default function ChatScreen() {
  const { userId, username, avatarUrl, privateReply } = useRoute<RouteProp<AppStackParamList, "Chat">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { subscribe, subscribeUpdate, setActiveThreadUserId, markRead } = useMessaging();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Search (filters currently-loaded messages, see chatSearch.ts) and Clear
  // chat (confirm-then-wipe, one-sided — see clearDmChat) are triggered from
  // DmInfoScreen now (via the onSearch/onClearChat callbacks handed to it
  // below), not a ⋯ menu on this screen anymore — but the state/logic for
  // both still lives here, since this screen owns the thread.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Message actions (long-press menu): reply / copy / forward / edit / delete /
  // react, plus the sticker panel. `replyTo` is an in-thread reply target;
  // `privateTarget` is a pending "reply privately" quote from a group chat.
  const [actionMsg, setActionMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [privateTarget, setPrivateTarget] = useState(privateReply ?? null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forwardItem, setForwardItem] = useState<ForwardItem | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerIdentity: { flexDirection: "row", alignItems: "center", flex: 1, marginHorizontal: spacing.md },
    headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: spacing.sm },
    headerAvatarPlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    },
    headerAvatarText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, flexShrink: 1 },
    searchFieldWrap: { flex: 1 },
    cancelSearch: { marginLeft: spacing.md },
    cancelSearchText: { fontSize: fontSize.base, color: colors.primary, fontWeight: "600" },
    spinner: { marginTop: spacing.xl },
    loadingMore: { marginVertical: spacing.md },
    list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexGrow: 1, justifyContent: "flex-end" },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" },
    composerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    composerInput: { flex: 1 },
    stickerButton: { paddingBottom: spacing.sm },
    editBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
      padding: spacing.sm,
      backgroundColor: colors.chipBackground,
      borderRadius: radius.sm,
    },
    editBarText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
    notice: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center", paddingBottom: spacing.sm },
    sendError: { color: colors.danger, fontSize: fontSize.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingInitial(true);
      setLoadError(null);
      try {
        const thread = await getThread(userId, PAGE_SIZE);
        if (cancelled) return;
        setMessages(thread);
        setHasMore(thread.length === PAGE_SIZE);
        const unread = thread.filter((m) => m.sender_id === userId && m.read_at === null).length;
        if (unread > 0) markRead(userId, unread);
      } catch {
        if (!cancelled) setLoadError("Couldn't load this conversation.");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    setActiveThreadUserId(userId);
    return () => {
      cancelled = true;
      setActiveThreadUserId(null);
    };
  }, [userId, markRead, setActiveThreadUserId]);

  useEffect(() => {
    return subscribe((message: Message) => {
      if (message.sender_id !== userId) return;
      setMessages((prev) => [message, ...prev]);
      markRead(userId, 1).catch(() => {});
    });
  }, [subscribe, userId, markRead]);

  // Edits, deletes and reactions made by either side arrive as updates to a
  // message that is already in the list.
  useEffect(() => {
    return subscribeUpdate((updated: Message) => {
      if (updated.sender_id !== userId && updated.recipient_id !== userId) return;
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    });
  }, [subscribeUpdate, userId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await getThread(userId, PAGE_SIZE, messages.length);
      setMessages((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch {
      // Silent — user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }, [userId, messages.length, loadingMore, hasMore]);

  function replaceMessage(updated: Message) {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function nameOf(senderId: string | null): string {
    if (senderId && senderId === user?.id) return "You";
    return username;
  }

  // Sends a new message (text or sticker) with whatever reply context is
  // pending; shows it immediately and swaps in the server copy.
  async function sendNew(text: string, kind: "text" | "sticker") {
    if (!user) return;
    setSendError(null);
    const quoteSource = replyTo;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      recipient_id: userId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
      kind,
      edited_at: null,
      deleted_at: null,
      forwarded: false,
      reactions: [],
      reply_to_id: quoteSource?.id ?? null,
      quote_text: quoteSource ? (quoteSource.kind === "sticker" ? "Sticker" : quoteSource.body) : (privateTarget?.text ?? null),
      quote_sender_id: quoteSource ? quoteSource.sender_id : privateTarget ? userId : null,
      quote_kind: quoteSource ? quoteSource.kind : privateTarget ? "text" : null,
    };
    setMessages((prev) => [optimistic, ...prev]);
    setSending(true);
    const privateId = privateTarget?.groupMessageId;
    setReplyTo(null);
    setPrivateTarget(null);
    try {
      const real = await sendMessage(userId, text, {
        kind,
        replyToId: quoteSource?.id,
        privateReplyGroupMessageId: quoteSource ? undefined : privateId,
      });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError(err instanceof ApiError ? err.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function onSend() {
    const text = draft.trim();
    if (!text || !user) return;
    setDraft("");

    if (editing) {
      const target = editing;
      setEditing(null);
      setSendError(null);
      setSending(true);
      try {
        replaceMessage(await editMessage(target.id, text));
      } catch (err) {
        setSendError(err instanceof ApiError ? err.message : "Couldn't edit. Try again.");
      } finally {
        setSending(false);
      }
      return;
    }
    await sendNew(text, "text");
  }

  async function onPickSticker(stickerId: string) {
    setStickerOpen(false);
    await sendNew(stickerId, "sticker");
  }

  function openActions(m: Message) {
    // Not-yet-confirmed (optimistic) messages have no server id to act on.
    if (m.id.startsWith("temp-")) return;
    Keyboard.dismiss();
    setActionMsg(m);
  }

  async function onReact(m: Message, emoji: string) {
    const mineNow = m.reactions.find((r) => r.user_id === user?.id)?.emoji;
    try {
      replaceMessage(await reactToMessage(m.id, mineNow === emoji ? null : emoji));
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Couldn't react. Try again.");
    }
  }

  function startEdit(m: Message) {
    setReplyTo(null);
    setPrivateTarget(null);
    setEditing(m);
    setDraft(m.body);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      replaceMessage(await deleteMessage(deleteTarget.id));
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Couldn't delete. Try again.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function jumpTo(messageId: string | null) {
    if (!messageId) return;
    const index = messages.findIndex((m) => m.id === messageId);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  async function onConfirmClear() {
    setClearing(true);
    try {
      await clearDmChat(userId);
      setMessages([]);
      setHasMore(false);
      setClearConfirmOpen(false);
    } catch {
      setLoadError("Couldn't clear this chat. Try again.");
      setClearConfirmOpen(false);
    } finally {
      setClearing(false);
    }
  }

  const displayedMessages = searchOpen ? filterMessagesByText(messages, searchQuery) : messages;

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      // "undefined" on Android means KeyboardAvoidingView does nothing at
      // all — that was the actual bug (composer sat there, keyboard just
      // covered it). "height" is the standard Android pairing for this;
      // "padding" is iOS's.
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        {searchOpen ? (
          <>
            <View style={styles.searchFieldWrap}>
              <SearchField placeholder="Search in chat" value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <Pressable onPress={closeSearch} hitSlop={12} style={styles.cancelSearch}>
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.headerIdentity}
              onPress={() =>
                navigation.navigate("DmInfo", {
                  userId,
                  username,
                  avatarUrl,
                  onSearch: () => setSearchOpen(true),
                  onClearChat: () => setClearConfirmOpen(true),
                })
              }
              hitSlop={4}
            >
              {avatarUrl ? (
                <Image source={{ uri: mediaUrl(avatarUrl)! }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>{username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {username}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {loadingInitial ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          ref={listRef}
          onScrollToIndexFailed={() => {}}
          data={displayedMessages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          // Drag the message list down and the keyboard dismisses with the
          // gesture, WhatsApp/Instagram-style — built into FlatList, no
          // extra dependency.
          keyboardDismissMode="interactive"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingMore} /> : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>
                {searchOpen && searchQuery.trim() ? "No matching messages." : (loadError ?? `Say hi to ${username}.`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              mine={item.sender_id === user?.id}
              myId={user?.id}
              quoteName={nameOf}
              onLongPress={() => openActions(item)}
              onQuotePress={item.reply_to_id ? () => jumpTo(item.reply_to_id) : undefined}
              onReactionPress={(emoji) => onReact(item, emoji)}
            />
          )}
        />
      )}

      {editing && (
        <View style={styles.editBar}>
          <Text style={styles.editBarText}>Editing message</Text>
          <Pressable onPress={cancelEdit} hitSlop={10} accessibilityLabel="Cancel edit">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      {!editing && replyTo && (
        <ReplyBar
          name={nameOf(replyTo.sender_id)}
          text={replyTo.kind === "sticker" ? "Sticker" : replyTo.body}
          onCancel={() => setReplyTo(null)}
        />
      )}
      {!editing && !replyTo && privateTarget && (
        <ReplyBar name={privateTarget.name} text={privateTarget.text} privateReply onCancel={() => setPrivateTarget(null)} />
      )}
      <View style={[styles.composerRow, { paddingBottom: stickerOpen ? spacing.md : insets.bottom + spacing.md }]}>
        {!editing && (
          <Pressable
            style={styles.stickerButton}
            hitSlop={8}
            accessibilityLabel="Stickers"
            onPress={() => {
              Keyboard.dismiss();
              setStickerOpen((open) => !open);
            }}
          >
            <Ionicons name={stickerOpen ? "keypad-outline" : "happy-outline"} size={28} color={colors.textMuted} />
          </Pressable>
        )}
        <TextField
          containerStyle={styles.composerInput}
          placeholder="Message..."
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setStickerOpen(false)}
          multiline
        />
        <Button label={editing ? "Save" : "Send"} onPress={onSend} loading={sending} disabled={!draft.trim()} />
      </View>
      {stickerOpen && !editing && <StickerPanel onPick={onPickSticker} />}
      {sendError && <Text style={styles.sendError}>{sendError}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <MessageActionSheet
        visible={actionMsg !== null}
        onClose={() => setActionMsg(null)}
        allowReactions={!actionMsg?.deleted_at}
        myReaction={actionMsg?.reactions.find((r) => r.user_id === user?.id)?.emoji ?? null}
        onReact={(emoji) => actionMsg && onReact(actionMsg, emoji)}
        onReply={
          actionMsg && !actionMsg.deleted_at
            ? () => {
                setEditing(null);
                setPrivateTarget(null);
                setReplyTo(actionMsg);
              }
            : undefined
        }
        onCopy={
          actionMsg && actionMsg.kind === "text" && !actionMsg.deleted_at
            ? () => {
                Clipboard.setStringAsync(actionMsg.body);
                setNotice("Copied");
                setTimeout(() => setNotice(null), 1500);
              }
            : undefined
        }
        onForward={
          actionMsg && !actionMsg.deleted_at ? () => setForwardItem({ kind: actionMsg.kind, body: actionMsg.body }) : undefined
        }
        onEdit={
          actionMsg && actionMsg.sender_id === user?.id && canEditMessage(actionMsg) ? () => startEdit(actionMsg) : undefined
        }
        onDelete={actionMsg && actionMsg.sender_id === user?.id && !actionMsg.deleted_at ? () => setDeleteTarget(actionMsg) : undefined}
      />

      <ForwardSheet
        visible={forwardItem !== null}
        item={forwardItem}
        onClose={() => setForwardItem(null)}
        onDone={(sent, failed) => {
          setNotice(failed ? `Forwarded to ${sent}, ${failed} failed` : `Forwarded to ${sent} chat${sent === 1 ? "" : "s"}`);
          setTimeout(() => setNotice(null), 2500);
        }}
      />

      <ConfirmSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this message?"
        body="It will be deleted for everyone in this chat."
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />

      <ConfirmSheet
        visible={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear this chat?"
        body="Messages will be cleared from your view only — it stays visible for the other person."
        confirmLabel="Clear chat"
        onConfirm={onConfirmClear}
        busy={clearing}
      />
    </KeyboardAvoidingView>
  );
}
