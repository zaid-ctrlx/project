import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { blockUser, getUserProfile, muteUser, PublicProfile, unblockUser, unmuteUser } from "../api/profile";
import ConfirmSheet from "../components/ConfirmSheet";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

// WhatsApp-style "Contact info" for a DM thread — reached by tapping the
// other person's name/avatar in ChatScreen's header (replacing what used
// to jump straight to UserProfile; that's now one menu row down instead —
// see "View profile" below). Mute/Search/Clear chat/Block all used to live
// spread across ChatScreen's header row and its ⋯ menu (ChatOptionsMenu);
// they're consolidated here instead, and that ⋯ menu is gone from
// ChatScreen entirely now that everything it held has a home here.
//
// Search and Clear chat are deliberately not reimplemented here — they
// stay exactly as they were in ChatScreen (searchOpen/clearConfirmOpen
// state, filterMessagesByText, clearDmChat), just triggered one screen
// away. ChatScreen hands this screen two callbacks (onSearch/onClearChat)
// via route params rather than duplicating that state/logic here, or
// having this screen mutate a chat thread it doesn't own.
export default function DmInfoScreen() {
  const { userId, username, avatarUrl, onSearch, onClearChat } = useRoute<RouteProp<AppStackParamList, "DmInfo">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    avatarPlaceholderText: { fontSize: 40, fontWeight: "700", color: colors.text },
    username: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.md, textAlign: "center" },
    spinner: { marginTop: spacing.xl },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    rowIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: { flex: 1, fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    rowTextDanger: { color: colors.danger },
    dangerZone: { marginTop: spacing.lg },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", padding: spacing.lg },
  }));

  useEffect(() => {
    let cancelled = false;
    getUserProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load mute/block settings for this contact.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onToggleMute() {
    if (!profile) return;
    const next = !profile.is_muted;
    setMuteBusy(true);
    setProfile({ ...profile, is_muted: next });
    try {
      await (next ? muteUser(userId) : unmuteUser(userId));
    } catch {
      setProfile((prev) => (prev ? { ...prev, is_muted: !next } : prev));
      setActionError("Couldn't update mute settings. Try again.");
    } finally {
      setMuteBusy(false);
    }
  }

  function goSearch() {
    navigation.goBack();
    onSearch();
  }

  function goClearChat() {
    navigation.goBack();
    onClearChat();
  }

  async function onConfirmBlock() {
    setBlockBusy(true);
    setActionError(null);
    try {
      await blockUser(userId);
      setProfile((prev) => (prev ? { ...prev, is_blocked: true } : prev));
      setBlockConfirmOpen(false);
    } catch {
      setActionError("Couldn't block this user. Try again.");
    } finally {
      setBlockBusy(false);
    }
  }

  async function onUnblock() {
    if (!profile) return;
    setBlockBusy(true);
    setActionError(null);
    try {
      await unblockUser(userId);
      setProfile({ ...profile, is_blocked: false });
    } catch {
      setActionError("Couldn't unblock this user. Try again.");
    } finally {
      setBlockBusy(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Contact Info</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.identity}>
        {avatarUrl ? (
          <Image source={{ uri: mediaUrl(avatarUrl)! }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.username}>{username}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => navigation.navigate("UserProfile", { userId })}
      >
        <View style={styles.rowIconWrap}>
          <Ionicons name="person-outline" size={18} color={colors.text} />
        </View>
        <Text style={styles.rowText}>View profile</Text>
      </Pressable>

      {!profile ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons
                name={profile.is_muted ? "notifications-off-outline" : "notifications-outline"}
                size={18}
                color={colors.text}
              />
            </View>
            <Text style={styles.rowText}>Mute notifications</Text>
            <Switch value={profile.is_muted} onValueChange={onToggleMute} disabled={muteBusy} trackColor={{ true: colors.primary }} />
          </View>

          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={goSearch}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="search-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>Search</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={goClearChat}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="trash-outline" size={18} color={colors.text} />
            </View>
            <Text style={styles.rowText}>Clear chat</Text>
          </Pressable>

          <View style={styles.dangerZone}>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => (profile.is_blocked ? onUnblock() : setBlockConfirmOpen(true))}
              disabled={blockBusy}
            >
              <View style={styles.rowIconWrap}>
                <Ionicons name="ban-outline" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.rowText, styles.rowTextDanger]}>
                {profile.is_blocked ? "Unblock" : "Block"}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {(loadError || actionError) && <Text style={styles.error}>{actionError ?? loadError}</Text>}

      <ConfirmSheet
        visible={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        title={`Block ${username}?`}
        body="They won't be able to message you, and neither of you will show up in each other's search."
        confirmLabel="Block"
        onConfirm={onConfirmBlock}
        busy={blockBusy}
      />
    </View>
  );
}
