import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "../components/Button";
import ProfileForm from "../components/ProfileForm";
import { useAuth } from "../context/AuthContext";
import { colors, fontSize, radius, spacing } from "../theme";

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);

  // Screen is only reachable once logged in (see App.tsx), so user is
  // always set here — this guard is just to satisfy TypeScript.
  if (!user) return null;

  if (editing) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Pressable onPress={() => setEditing(false)} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit profile</Text>
        </View>
        <ProfileForm
          initialUsername={user.username}
          initialTagIds={user.tags.map((t) => t.id)}
          initialLocationLabel={user.location_label}
          initialLocationCoords={
            user.location_lat != null && user.location_lng != null
              ? { lat: user.location_lat, lng: user.location_lng }
              : null
          }
          submitLabel="Save changes"
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
      contentContainerStyle={[styles.viewContainer, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
      </View>

      <Text style={styles.username}>@{user.username}</Text>
      {user.full_name && <Text style={styles.fullName}>{user.full_name}</Text>}
      <Text style={styles.email}>{user.email}</Text>

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

      <View style={styles.actions}>
        <Button label="Edit profile" onPress={() => setEditing(true)} variant="secondary" />
        <View style={styles.buttonGap} />
        <Button label="Log out" onPress={logout} variant="text" danger />
      </View>
    </ScrollView>
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
  },
  cancel: { fontSize: fontSize.md, color: colors.text, width: 70 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  viewContainer: { alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: colors.text },
  username: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  fullName: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs },
  email: { fontSize: fontSize.base, color: colors.textFaint, marginTop: spacing.xs },
  metaBlock: { alignItems: "center", marginTop: spacing.lg, width: "100%" },
  meta: { fontSize: fontSize.base, color: colors.textMuted, marginBottom: spacing.sm },
  tagRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.chipBackground,
  },
  tagChipText: { fontSize: fontSize.sm, color: colors.text },
  actions: { marginTop: spacing.xxl, alignItems: "center", width: "100%" },
  buttonGap: { height: spacing.md },
});
