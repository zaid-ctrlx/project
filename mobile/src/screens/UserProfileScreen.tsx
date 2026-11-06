import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError } from "../api/client";
import { acceptConnection, ConnectionStatus, removeConnection, sendConnectionRequest } from "../api/connections";
import { blockUser, getUserProfile, getUserStats, PublicProfile, unblockUser, UserStats } from "../api/profile";
import Button from "../components/Button";
import ConfirmSheet from "../components/ConfirmSheet";
import OptionsMenu from "../components/OptionsMenu";
import ProfileHeader from "../components/ProfileHeader";
import ProfileTabs from "../components/ProfileTabs";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

export default function UserProfileScreen() {
  const { userId } = useRoute<RouteProp<AppStackParamList, "UserProfile">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockActionBusy, setBlockActionBusy] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [blockActionError, setBlockActionError] = useState<string | null>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerSpacer: { width: 26 },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    spinner: { marginTop: spacing.xl },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
    container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    profileRow: { flexDirection: "row", alignItems: "center" },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.lg,
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40, marginRight: spacing.lg },
    avatarText: { fontSize: 30, fontWeight: "700", color: colors.text },
    identity: { flex: 1 },
    username: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
    fullName: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    bio: { fontSize: fontSize.base, color: colors.text },
    metaBlock: { marginTop: spacing.sm },
    sectionTitle: {
      fontSize: fontSize.base,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tagChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.chipBackground,
    },
    tagChipText: { fontSize: fontSize.sm, color: colors.text },
    actionRow: { flexDirection: "row", gap: spacing.sm },
    actionCell: { flex: 1 },
    blockedNotice: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: "italic" },
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getUserProfile(userId);
        if (!cancelled) setProfile(result);
        // Numbers are a nice-to-have: the profile still shows if they fail.
        getUserStats(userId)
          .then((s) => !cancelled && setStats(s))
          .catch(() => {});
      } catch {
        if (!cancelled) setError("Couldn't load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onConfirmBlock() {
    if (!profile) return;
    setBlockActionBusy(true);
    setBlockActionError(null);
    try {
      await blockUser(profile.id);
      setProfile({ ...profile, is_blocked: true });
      setBlockConfirmOpen(false);
    } catch (err) {
      setBlockActionError(err instanceof ApiError ? err.message : "Couldn't block this user. Try again.");
    } finally {
      setBlockActionBusy(false);
    }
  }

  // One handler for every state of the Connect button: connect / accept
  // (when they asked me first) / cancel my request / disconnect.
  async function onConnectPress() {
    if (!profile || connectBusy) return;
    const current = profile.connection_status;
    setConnectBusy(true);
    setBlockActionError(null);
    try {
      const result =
        current === "none"
          ? await sendConnectionRequest(profile.id)
          : current === "pending_in"
            ? await acceptConnection(profile.id)
            : await removeConnection(profile.id);
      setProfile({ ...profile, connection_status: result.status as ConnectionStatus });
      getUserStats(profile.id)
        .then(setStats)
        .catch(() => {});
    } catch (err) {
      setBlockActionError(err instanceof ApiError ? err.message : "Couldn't update the connection. Try again.");
    } finally {
      setConnectBusy(false);
    }
  }

  const connectLabel: Record<ConnectionStatus, string> = {
    none: "Connect",
    pending_out: "Requested",
    pending_in: "Accept request",
    connected: "Connected",
  };

  async function onUnblock() {
    if (!profile) return;
    setMenuOpen(false);
    setBlockActionError(null);
    try {
      await unblockUser(profile.id);
      setProfile({ ...profile, is_blocked: false });
    } catch (err) {
      setBlockActionError(err instanceof ApiError ? err.message : "Couldn't unblock this user. Try again.");
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        {profile ? (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : !profile ? (
        <Text style={styles.error}>{error ?? "Something went wrong."}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <ProfileHeader
            avatarUrl={profile.avatar_url}
            username={profile.username}
            fullName={profile.full_name}
            bio={profile.bio}
            stats={stats}
          />

          {profile.is_blocked ? (
            <Text style={styles.blockedNotice}>You've blocked this user. Unblock them from the ⋯ menu to message them again.</Text>
          ) : (
            <View style={styles.actionRow}>
              <View style={styles.actionCell}>
                <Button
                  label={connectLabel[profile.connection_status]}
                  onPress={onConnectPress}
                  variant={profile.connection_status === "none" || profile.connection_status === "pending_in" ? "primary" : "secondary"}
                  loading={connectBusy}
                />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label="Message"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate("Chat", {
                      userId: profile.id,
                      username: profile.username,
                      avatarUrl: profile.avatar_url,
                    })
                  }
                />
              </View>
            </View>
          )}
          {blockActionError && <Text style={styles.error}>{blockActionError}</Text>}

          {profile.tags.length > 0 && (
            <View style={styles.metaBlock}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.tagRow}>
                {profile.tags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.metaBlock}>
            <ProfileTabs userId={profile.id} isOwn={false} />
          </View>
        </ScrollView>
      )}

      {profile && (
        <>
          <OptionsMenu
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={
              profile.is_blocked
                ? [{ label: "Unblock", onPress: onUnblock }]
                : [{ label: "Block", destructive: true, onPress: () => setBlockConfirmOpen(true) }]
            }
          />
          <ConfirmSheet
            visible={blockConfirmOpen}
            onClose={() => setBlockConfirmOpen(false)}
            title={`Block ${profile.username}?`}
            body="They won't be able to message you, and neither of you will show up in each other's search."
            confirmLabel="Block"
            onConfirm={onConfirmBlock}
            busy={blockActionBusy}
          />
        </>
      )}
    </View>
  );
}
