import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { BlockedUser, getBlockedUsers, unblockUser } from "../api/profile";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";

// Pushed from Settings' "Blocked profiles" row. Refetches on every focus
// (same as GroupInfoScreen's member list) so unblocking from here and
// coming back doesn't show a stale row.
export default function BlockedUsersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
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
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
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
    rowText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    unblockText: { fontSize: fontSize.base, color: colors.primary, fontWeight: "600" },
    unblockTextDisabled: { color: colors.textFaint },
    empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
  }));

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await getBlockedUsers());
    } catch {
      setError("Couldn't load your blocked profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onUnblock(userId: string) {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError("Couldn't unblock. Try again.");
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked Profiles</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatar_url ? (
                <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImageSm} />
              ) : (
                <View style={styles.avatarSm}>
                  <Text style={styles.avatarSmText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.username}>{item.username}</Text>
                {item.full_name && (
                  <Text style={styles.fullName} numberOfLines={1}>
                    {item.full_name}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => onUnblock(item.id)} disabled={unblockingId === item.id} hitSlop={8}>
                <Text style={[styles.unblockText, unblockingId === item.id && styles.unblockTextDisabled]}>
                  {unblockingId === item.id ? "Unblocking..." : "Unblock"}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No blocked profiles</Text>
              <Text style={styles.emptyBody}>{error ?? "Accounts you block will show up here."}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
