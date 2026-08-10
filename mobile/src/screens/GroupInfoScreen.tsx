import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { ChatGroup, getGroup, GroupMember } from "../api/groups";
import { useAuth } from "../context/AuthContext";
import type { AppStackParamList } from "../navigation/AppStack";
import { colors, fontSize, radius, spacing } from "../theme";

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

  const isAdmin = group?.members.find((m) => m.user.id === currentUser?.id)?.role === "admin";

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Group Info</Text>
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
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
