import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import { ChatGroup, deleteGroup, getGroup, GroupMember, setGroupMuted } from "../api/groups";
import ConfirmDeleteSheet from "../components/ConfirmDeleteSheet";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

// WhatsApp-style group profile, scoped down to what's actually built so
// far: group identity + the members list (tap a member -> ContactInfo).
// No media/links/docs, no group description editing, no exit-group yet.
export default function GroupInfoScreen() {
  const { groupId } = useRoute<RouteProp<AppStackParamList, "GroupInfo">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
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
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    headerSpacer: { width: 26 },
    spinner: { marginTop: spacing.xl },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
    list: { paddingBottom: spacing.xxl },
    identity: { alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
    avatarImage: { width: 112, height: 112, borderRadius: 56 },
    avatarPlaceholder: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    groupName: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.md, textAlign: "center" },
    memberCount: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      gap: spacing.md,
      paddingVertical: spacing.md,
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    addRowPressed: { backgroundColor: colors.chipBackground },
    addIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    addText: { fontSize: fontSize.md, color: colors.primary, fontWeight: "600" },
    muteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      alignSelf: "stretch",
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    muteLabelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    muteIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    muteText: { fontSize: fontSize.md, color: colors.text, fontWeight: "600" },
    sectionTitle: {
      alignSelf: "stretch",
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    avatarSm: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImageSm: { width: 44, height: 44, borderRadius: 22 },
    avatarSmText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    username: { flex: 1, fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    adminBadge: {
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.chipBackground,
    },
    adminBadgeText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: "600" },
    deleteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    deleteRowPressed: { backgroundColor: colors.chipBackground },
    deleteText: { fontSize: fontSize.md, color: colors.danger, fontWeight: "600" },
    deleteError: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", padding: spacing.lg },
  }));

  // silent skips the full-screen spinner — used by pull-to-refresh, which
  // has its own (the native RefreshControl one). Not that `loading` alone
  // would show it again here anyway once `group` is already set (see the
  // `loading && !group` render check below) — silent just also skips the
  // pointless setLoading churn.
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setError(null);
      try {
        const g = await getGroup(groupId);
        setGroup(g);
      } catch {
        setError("Couldn't load this group.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [groupId]
  );

  // Refetches on every focus, not just on mount — unlike most
  // eventual-consistency spots in this app (see GroupChatScreen's own
  // comment), a stale member list here would visibly still show someone
  // who was *just* removed via ContactInfoScreen one screen up. Same
  // pattern MessagesScreen uses for its conversation list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  const myMembership = group?.members.find((m) => m.user.id === currentUser?.id);
  const isAdmin = myMembership?.role === "admin";

  async function onToggleMute() {
    if (!group || !myMembership) return;
    const next = !myMembership.muted;
    setMuteBusy(true);
    setGroup((prev) =>
      prev
        ? { ...prev, members: prev.members.map((m) => (m.user.id === currentUser?.id ? { ...m, muted: next } : m)) }
        : prev
    );
    try {
      await setGroupMuted(group.id, next);
    } catch {
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) => (m.user.id === currentUser?.id ? { ...m, muted: !next } : m)),
            }
          : prev
      );
    } finally {
      setMuteBusy(false);
    }
  }

  async function onConfirmDelete() {
    if (!group) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGroup(group.id);
      // The group no longer exists — GroupChat (one screen back) would be
      // broken if we just popped to it, so jump all the way out to the
      // tab bar instead, same as DeleteAccountScreen effectively does by
      // swapping the whole navigator.
      navigation.navigate("Tabs");
    } catch (err) {
      setDeleteOpen(false);
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete this group. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{group?.is_community ? "Community Info" : "Group Info"}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !group ? (
        <ActivityIndicator style={styles.spinner} />
      ) : !group ? (
        <Text style={styles.error}>{error ?? "Couldn't load this group."}</Text>
      ) : (
        <FlatList
          data={group.members}
          keyExtractor={(m: GroupMember) => m.user.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.identity}>
              {group.avatar_url ? (
                <Image source={{ uri: mediaUrl(group.avatar_url)! }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="people" size={40} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.memberCount}>{group.members.length} members</Text>

              {isAdmin && (
                <Pressable
                  style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}
                  onPress={() => navigation.navigate("AddGroupMember", { groupId })}
                >
                  <View style={styles.addIconWrap}>
                    <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.addText}>Add participant</Text>
                </Pressable>
              )}

              <View style={styles.muteRow}>
                <View style={styles.muteLabelWrap}>
                  <View style={styles.muteIconWrap}>
                    <Ionicons
                      name={myMembership?.muted ? "notifications-off-outline" : "notifications-outline"}
                      size={18}
                      color={colors.text}
                    />
                  </View>
                  <Text style={styles.muteText}>Mute notifications</Text>
                </View>
                <Switch
                  value={myMembership?.muted ?? false}
                  onValueChange={onToggleMute}
                  disabled={muteBusy}
                  trackColor={{ true: colors.primary }}
                />
              </View>

              <Text style={styles.sectionTitle}>{group.members.length} Members</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate("ContactInfo", { groupId, userId: item.user.id })}
            >
              {item.user.avatar_url ? (
                <Image source={{ uri: mediaUrl(item.user.avatar_url)! }} style={styles.avatarImageSm} />
              ) : (
                <View style={styles.avatarSm}>
                  <Text style={styles.avatarSmText}>{item.user.username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.username} numberOfLines={1}>
                {item.user.username}
                {item.user.id === currentUser?.id ? " (You)" : ""}
              </Text>
              {item.role === "admin" && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </Pressable>
          )}
          ListFooterComponent={
            isAdmin ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.deleteRow, pressed && styles.deleteRowPressed]}
                  onPress={() => setDeleteOpen(true)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={styles.deleteText}>Delete group</Text>
                </Pressable>
                {deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
              </>
            ) : null
          }
        />
      )}

      <ConfirmDeleteSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this group?"
        body="Every member loses access to it and its entire message history. This can't be undone."
        confirmLabel="Delete group"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
    </View>
  );
}
