import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";

import { ApiError, mediaUrl } from "../api/client";
import { approveJoinRequest, JoinRequest, listJoinRequests, rejectJoinRequest } from "../api/events";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Admin view of an approval-only community's pending applicants. Approving
// adds the person to the community and notifies them; declining just
// notifies them (they can ask again later). The server enforces that only a
// community admin can list or decide (403 otherwise).
export default function JoinRequestsScreen() {
  const { eventId, eventTitle } = useRoute<RouteProp<AppStackParamList, "JoinRequests">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

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
    subtitle: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, fontSize: fontSize.base, color: colors.textMuted },
    spinner: { marginTop: spacing.xl },
    list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },
    error: { color: colors.danger, fontSize: fontSize.base, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    person: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    personText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    meta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    actions: { flexDirection: "row", gap: spacing.sm },
    action: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    approve: { backgroundColor: colors.primary },
    approveText: { color: colors.primaryText, fontWeight: "700", fontSize: fontSize.base },
    decline: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    declineText: { color: colors.text, fontWeight: "600", fontSize: fontSize.base },
    disabled: { opacity: 0.5 },
    empty: { alignItems: "center", marginTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", maxWidth: 260 },
  }));

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        setRequests(await listJoinRequests(eventId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load join requests. Check your connection.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [eventId]
  );

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

  async function decide(req: JoinRequest, approve: boolean) {
    const userId = req.user.id;
    setBusyIds((prev) => new Set(prev).add(userId));
    setError(null);
    try {
      await (approve ? approveJoinRequest(eventId, userId) : rejectJoinRequest(eventId, userId));
      setRequests((prev) => prev.filter((r) => r.user.id !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(userId);
        return s;
      });
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Join requests</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>
        {eventTitle}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.user.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          renderItem={({ item }) => {
            const busy = busyIds.has(item.user.id);
            return (
              <View style={styles.card}>
                <Pressable
                  style={styles.person}
                  onPress={() => navigation.navigate("UserProfile", { userId: item.user.id })}
                >
                  {item.user.avatar_url ? (
                    <Image source={{ uri: mediaUrl(item.user.avatar_url)! }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.user.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.personText}>
                    <Text style={styles.username}>{item.user.username}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.user.full_name ? `${item.user.full_name} · ` : ""}requested {timeAgo(item.created_at)}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => decide(item, false)}
                    style={[styles.action, styles.decline, busy && styles.disabled]}
                  >
                    <Ionicons name="close" size={18} color={colors.text} />
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => decide(item, true)}
                    style={[styles.action, styles.approve, busy && styles.disabled]}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.primaryText} />
                    <Text style={styles.approveText}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-add-outline" size={36} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptyBody}>When someone asks to join, they'll show up here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
