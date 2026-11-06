import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";

import { acceptConnection, listConnectionRequests, listConnections, listSentRequests, removeConnection } from "../api/connections";
import { mediaUrl } from "../api/client";
import type { UserSearchResult } from "../api/profile";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

type Tab = "connections" | "requests" | "sent";

// Your mutual connections, plus the requests waiting on you. Accepting adds
// the person to both sides' count; declining just drops the request.
export default function ConnectionsScreen() {
  const { initialTab } = useRoute<RouteProp<AppStackParamList, "Connections">>().params ?? {};
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>(initialTab ?? "connections");
  const [connections, setConnections] = useState<UserSearchResult[] | null>(null);
  const [requests, setRequests] = useState<UserSearchResult[] | null>(null);
  const [sent, setSent] = useState<UserSearchResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    headerSpacer: { width: 26 },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginHorizontal: spacing.xl,
    },
    tab: { paddingVertical: spacing.md, marginRight: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary, marginBottom: -1 },
    tabText: { fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
    tabTextActive: { color: colors.text },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.primaryText, fontSize: 11, fontWeight: "700" },
    list: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    identity: { flex: 1 },
    username: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
    actions: { flexDirection: "row", gap: spacing.sm },
    accept: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    acceptText: { color: colors.primaryText, fontSize: fontSize.sm, fontWeight: "700" },
    decline: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    declineText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
    empty: { textAlign: "center", color: colors.textFaint, fontSize: fontSize.base, marginTop: spacing.xxl },
    spinner: { marginTop: spacing.xl },
  }));

  const load = useCallback(async () => {
    try {
      const [c, r, s] = await Promise.all([listConnections(), listConnectionRequests(), listSentRequests()]);
      setConnections(c);
      setRequests(r);
      setSent(s);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function respond(user: UserSearchResult, accept: boolean) {
    if (busyId) return;
    setBusyId(user.id);
    try {
      await (accept ? acceptConnection(user.id) : removeConnection(user.id));
      setRequests((list) => (list ?? []).filter((u) => u.id !== user.id));
      setSent((list) => (list ?? []).filter((u) => u.id !== user.id));
      if (accept) setConnections((list) => [...(list ?? []), user].sort((a, b) => a.username.localeCompare(b.username)));
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  }

  const data = tab === "connections" ? connections : tab === "requests" ? requests : sent;
  const pendingCount = requests?.length ?? 0;

  function renderItem({ item }: { item: UserSearchResult }) {
    return (
      <Pressable style={styles.row} onPress={() => navigation.navigate("UserProfile", { userId: item.id })}>
        {item.avatar_url ? (
          <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={styles.username} numberOfLines={1}>
            {item.username}
          </Text>
          {item.full_name ? (
            <Text style={styles.fullName} numberOfLines={1}>
              {item.full_name}
            </Text>
          ) : null}
        </View>
        {tab === "sent" && (
          <Pressable style={styles.decline} onPress={() => respond(item, false)} disabled={busyId === item.id}>
            <Text style={styles.declineText}>Cancel</Text>
          </Pressable>
        )}
        {tab === "requests" && (
          <View style={styles.actions}>
            <Pressable style={styles.decline} onPress={() => respond(item, false)} disabled={busyId === item.id}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.accept} onPress={() => respond(item, true)} disabled={busyId === item.id}>
              <Text style={styles.acceptText}>Accept</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabBar}>
        <Pressable onPress={() => setTab("connections")} style={[styles.tab, tab === "connections" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "connections" && styles.tabTextActive]}>
            Connected{connections ? ` (${connections.length})` : ""}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab("requests")} style={[styles.tab, tab === "requests" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "requests" && styles.tabTextActive]}>Received</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setTab("sent")} style={[styles.tab, tab === "sent" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "sent" && styles.tabTextActive]}>
            Sent{sent && sent.length > 0 ? ` (${sent.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {data === null && !failed ? (
        <ActivityIndicator style={styles.spinner} color={colors.textMuted} />
      ) : failed && data === null ? (
        <Pressable onPress={load}>
          <Text style={styles.empty}>Couldn't load this. Tap to retry.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === "connections"
                ? "No connections yet. Visit someone's profile to connect."
                : tab === "requests"
                  ? "No requests waiting for you."
                  : "You haven't sent any pending requests."}
            </Text>
          }
        />
      )}
    </View>
  );
}
