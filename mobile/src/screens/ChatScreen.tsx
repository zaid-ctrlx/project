import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, mediaUrl } from "../api/client";
import { clearDmChat, getThread, Message, sendMessage } from "../api/messages";
import Button from "../components/Button";
import ConfirmSheet from "../components/ConfirmSheet";
import SearchField from "../components/SearchField";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useMessaging } from "../context/MessagingContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { filterMessagesByText } from "../lib/chatSearch";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

const PAGE_SIZE = 30;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ChatScreen() {
  const { userId, username, avatarUrl } = useRoute<RouteProp<AppStackParamList, "Chat">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { subscribe, setActiveThreadUserId, markRead } = useMessaging();

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
    bubbleRow: { marginVertical: spacing.xs, maxWidth: "80%" },
    bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
    bubble: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    bubbleMine: { backgroundColor: colors.primary },
    bubbleTheirs: { backgroundColor: colors.chipBackground },
    bubbleText: { fontSize: fontSize.base, color: colors.text },
    bubbleTextMine: { color: colors.primaryText },
    timestamp: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs },
    timestampMine: { textAlign: "right" },
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

  async function onSend() {
    const text = draft.trim();
    if (!text || !user) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      recipient_id: userId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [optimistic, ...prev]);
    setDraft("");
    setSending(true);
    try {
      const real = await sendMessage(userId, text);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError(err instanceof ApiError ? err.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
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
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingMore} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>
                {searchOpen && searchQuery.trim() ? "No matching messages." : (loadError ?? `Say hi to ${username}.`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
                <Text style={[styles.timestamp, mine && styles.timestampMine]}>{formatTime(item.created_at)}</Text>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.composerRow, { paddingBottom: insets.bottom + spacing.md }]}>
        <TextField
          containerStyle={styles.composerInput}
          placeholder="Message..."
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Button label="Send" onPress={onSend} loading={sending} disabled={!draft.trim()} />
      </View>
      {sendError && <Text style={styles.sendError}>{sendError}</Text>}

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
