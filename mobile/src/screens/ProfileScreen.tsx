import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import Button from "../components/Button";
import OptionsMenu from "../components/OptionsMenu";
import ProfileForm from "../components/ProfileForm";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

export default function ProfileScreen() {
  const { user, setUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    cancel: { fontSize: fontSize.md, color: colors.text, width: 70 },
    headerSpacer: { width: 70 },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    viewContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    topBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
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
    bio: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.md },
    actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    actionButton: { flex: 1 },
    metaBlock: { marginTop: spacing.xl },
    meta: { fontSize: fontSize.base, color: colors.textMuted, marginBottom: spacing.sm },
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
  }));

  // Screen is only reachable once logged in (see App.tsx), so user is
  // always set here — this guard is just to satisfy TypeScript.
  if (!user) return null;

  async function onShare() {
    try {
      await Share.share({ message: `Check out @${user!.username}'s profile` });
    } catch {
      // Share sheet unavailable on this platform (e.g. some desktop
      // browsers) — nothing useful to do, just don't crash the screen.
    }
  }

  if (editing) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}>
          <Pressable onPress={() => setEditing(false)} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ProfileForm
          initialFullName={user.full_name}
          initialUsername={user.username}
          initialBio={user.bio}
          initialGender={user.gender}
          initialAvatarUrl={user.avatar_url}
          initialTagIds={user.tags.map((t) => t.id)}
          initialLocationLabel={user.location_label}
          initialLocationCoords={
            user.location_lat != null && user.location_lng != null
              ? { lat: user.location_lat, lng: user.location_lng }
              : null
          }
          submitLabel="Save changes"
          onAvatarUpdated={setUser}
          onSaved={(updated) => {
            setUser(updated);
            setEditing(false);
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrapper}
      contentContainerStyle={[styles.viewContainer, { paddingTop: insets.top + spacing.xxl }]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => setCreateMenuOpen(true)} hitSlop={12}>
          <Ionicons name="add-circle-outline" size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.profileRow}>
        {user.avatar_url ? (
          <Image source={{ uri: mediaUrl(user.avatar_url)! }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={styles.username}>{user.username}</Text>
          {user.full_name && <Text style={styles.fullName}>{user.full_name}</Text>}
        </View>
      </View>

      {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          <Button label="Edit profile" onPress={() => setEditing(true)} variant="secondary" />
        </View>
        <View style={styles.actionButton}>
          <Button label="Share profile" onPress={onShare} variant="secondary" />
        </View>
      </View>

      {(user.location_label || user.tags.length > 0) && (
        <View style={styles.metaBlock}>
          {user.location_label && <Text style={styles.meta}>📍 {user.location_label}</Text>}
          {user.tags.length > 0 && (
            <View style={styles.tagRow}>
              {user.tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Only two kinds for now — event (one-time) and community
          (repeating); more are meant to slot into this same list later. */}
      <OptionsMenu
        visible={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        title="Create"
        items={[
          {
            label: EVENT_KIND_LABELS.event,
            onPress: () => navigation.navigate("CreatePost", { kind: "event" }),
          },
          {
            label: EVENT_KIND_LABELS.community,
            onPress: () => navigation.navigate("CreatePost", { kind: "community" }),
          },
        ]}
      />
    </ScrollView>
  );
}
