import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { ChatGroup, getGroup, getGroupThread, GroupMessage, sendGroupMessage } from "../api/groups";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useMessaging } from "../context/MessagingContext";
import type { AppStackParamList } from "../navigation/AppStack";
import { colors, fontSize, radius, spacing } from "../theme";

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

  const isAdmin = group?.members.find((m) => m.user.id === user?.id)?.role === "admin";
  // Falls back to the nav param until the full group detail loads, then
  // prefers the live count (matters after adding members — see
  // AddGroupMemberScreen; GroupChatScreen doesn't refetch on its own focus,
  // same eventual-consistency tradeoff as elsewhere in this app).
  const displayedMemberCount = group?.members.length ?? memberCount;

  function senderName(userId: string): string {
    if (userId === user?.id) return "You";
    return group?.members.find((m) => m.user.id === userId)?.user.username ?? "Someone";
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerIdentity}>
          <View style={styles.headerAvatarPlaceholder}>
            <Ionicons name="people" size={18} color={colors.textMuted} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {groupName}
            </Text>
            <Text style={styles.headerSubtitle}>{displayedMemberCount} members</Text>
          </View>
        </View>
        {isAdmin ? (
          <Pressable onPress={() => navigation.navigate("AddGroupMember", { groupId })} hitSlop={12}>
            <Ionicons name="person-add-outline" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loadingInitial ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingMore} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyBody}>{loadError ?? `Say hi to the group.`}</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Mirrors ChatScreen's styling exactly (header/bubble/composer) plus
  // senderName for the multi-sender case — see its own comment on
  // headerIdentity for why it's a View here, not a Pressable (no single
  // "other person" profile to jump to for a group).
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
  headerSpacer: { width: 26 },
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
});
