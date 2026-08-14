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
import { ChatGroup, clearGroupChat, getGroup, getGroupThread, GroupMessage, sendGroupMessage } from "../api/groups";
import Button from "../components/Button";
import ChatOptionsMenu from "../components/ChatOptionsMenu";
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

export default function GroupChatScreen() {
  const { groupId, groupName, memberCount, unreadCount } = useRoute<RouteProp<AppStackParamList, "GroupChat">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { subscribeGroup, setActiveGroupId, markGroupRead } = useMessaging();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // ⋯ menu -> Add members, Search (filters currently-loaded messages, see
  // chatSearch.ts), and Clear chat (confirm-then-wipe, one-sided — see
  // clearGroupChat). Same shape as ChatScreen's, plus Add members.
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Mirrors ChatScreen's styling exactly (header/bubble/composer/search)
  // plus senderName for the multi-sender case. headerIdentity is a
  // Pressable here too (like ChatScreen's), but opens GroupInfo instead of
  // a single person's UserProfile — there's no one "other person" for a
  // group.
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
    headerTextCol: { flex: 1 },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, flexShrink: 1 },
    headerSubtitle: { fontSize: fontSize.sm, color: colors.textMuted },
    searchFieldWrap: { flex: 1 },
    cancelSearch: { marginLeft: spacing.md },
    cancelSearchText: { fontSize: fontSize.base, color: colors.primary, fontWeight: "600" },
    spinner: { marginTop: spacing.xl },
    loadingMore: { marginVertical: spacing.md },
    list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexGrow: 1, justifyContent: "flex-end" },
    bubbleRow: { marginVertical: spacing.xs, maxWidth: "80%" },
    bubbleRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
    bubbleRowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
    senderName: { fontSize: fontSize.sm, color: colors.textFaint, marginBottom: spacing.xs, marginLeft: spacing.xs },
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
        const [detail, thread] = await Promise.all([getGroup(groupId), getGroupThread(groupId, PAGE_SIZE)]);
        if (cancelled) return;
        setGroup(detail);
        setMessages(thread);
        setHasMore(thread.length === PAGE_SIZE);
      } catch {
        if (!cancelled) setLoadError("Couldn't load this group.");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    if (unreadCount) markGroupRead(groupId, unreadCount);
    setActiveGroupId(groupId);
    return () => {
      cancelled = true;
      setActiveGroupId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    return subscribeGroup((message: GroupMessage) => {
      if (message.group_id !== groupId) return;
      setMessages((prev) => [message, ...prev]);
      markGroupRead(groupId, 1).catch(() => {});
    });
  }, [subscribeGroup, groupId, markGroupRead]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = await getGroupThread(groupId, PAGE_SIZE, messages.length);
      setMessages((prev) => [...prev, ...nextPage]);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch {
      // Silent — user can retry by scrolling again.
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, messages.length, loadingMore, hasMore]);

  async function onSend() {
    const text = draft.trim();
    if (!text || !user) return;

    setSendError(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: GroupMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
      sender_username: user.username,
    };
    setMessages((prev) => [optimistic, ...prev]);
    setDraft("");
    setSending(true);
    try {
      const real = await sendGroupMessage(groupId, text);
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
      await clearGroupChat(groupId);
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

  // Falls back to the nav param until the full group detail loads, then
  // prefers the live count (matters after adding/removing members — see
  // AddGroupMemberScreen/ContactInfoScreen; GroupChatScreen doesn't refetch
  // on its own focus, same eventual-consistency tradeoff as elsewhere in
  // this app — GroupInfoScreen, reachable from the header below, does
  // refetch on focus and is where that becomes visible sooner).
  const displayedMemberCount = group?.members.length ?? memberCount;
  const displayedMessages = searchOpen ? filterMessagesByText(messages, searchQuery) : messages;

  function senderName(userId: string): string {
    if (userId === user?.id) return "You";
    return group?.members.find((m) => m.user.id === userId)?.user.username ?? "Someone";
  }

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
              onPress={() => navigation.navigate("GroupInfo", { groupId })}
              hitSlop={4}
            >
              {group?.avatar_url ? (
                <Image source={{ uri: mediaUrl(group.avatar_url)! }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Ionicons name="people" size={18} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {groupName}
                </Text>
                <Text style={styles.headerSubtitle}>{displayedMemberCount} members</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
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
                {searchOpen && searchQuery.trim() ? "No matching messages." : (loadError ?? `Say hi to the group.`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                {!mine && <Text style={styles.senderName}>{senderName(item.sender_id)}</Text>}
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

      <ChatOptionsMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSearch={() => setSearchOpen(true)}
        onClearChat={() => setClearConfirmOpen(true)}
        onAddMembers={() => navigation.navigate("AddGroupMember", { groupId })}
      />
      <ConfirmSheet
        visible={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear this chat?"
        body="Messages will be cleared from your view only — everyone else still sees the full history."
        confirmLabel="Clear chat"
        onConfirm={onConfirmClear}
        busy={clearing}
      />
    </KeyboardAvoidingView>
  );
}
