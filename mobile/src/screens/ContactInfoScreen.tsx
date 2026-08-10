import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { ChatGroup, getGroup, removeGroupMember } from "../api/groups";
import ConfirmSheet from "../components/ConfirmSheet";
import { useAuth } from "../context/AuthContext";
import type { AppStackParamList } from "../navigation/AppStack";
import { colors, fontSize, radius, spacing } from "../theme";

// Reached by tapping a member in GroupInfoScreen's list. Layout is
// deliberately minimal per spec: photo, name, a row of three equal blocks
// (Message is real; the other two are placeholders — visibly present, not
// wired to anything yet), then — with a clear gap — Remove from group,
// shown only to admins and never on your own card.
export default function ContactInfoScreen() {
  const { groupId, userId } = useRoute<RouteProp<AppStackParamList, "ContactInfo">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await getGroup(groupId);
        if (!cancelled) setGroup(g);
      } catch {
        if (!cancelled) setError("Couldn't load this member.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const member = group?.members.find((m) => m.user.id === userId);
  const isAdmin = group?.members.find((m) => m.user.id === currentUser?.id)?.role === "admin";
  const isSelf = userId === currentUser?.id;
  const canRemove = isAdmin && !isSelf;

  async function onConfirmRemove() {
    setRemoving(true);
    setError(null);
    try {
      await removeGroupMember(groupId, userId);
      navigation.goBack();
    } catch {
      setConfirmOpen(false);
      setError("Couldn't remove this member. Try again.");
    } finally {
      setRemoving(false);
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

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : !member ? (
        <Text style={styles.error}>{error ?? "Member not found."}</Text>
      ) : (
        <View style={styles.container}>
          {member.user.avatar_url ? (
            <Image source={{ uri: mediaUrl(member.user.avatar_url)! }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{member.user.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.username}>
            {member.user.username}
            {isSelf ? " (You)" : ""}
          </Text>
          {member.role === "admin" && <Text style={styles.roleBadge}>Group admin</Text>}

          {!isSelf && (
            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionBlock}
                onPress={() =>
                  navigation.navigate("Chat", {
                    userId: member.user.id,
                    username: member.user.username,
                    avatarUrl: member.user.avatar_url,
                  })
                }
              >
                <View style={styles.actionCircle}>
                  <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.actionLabel}>Message</Text>
              </Pressable>
              {/* Two more, for time being — visibly present so the layout
                  reads as "more coming", not wired to anything yet. */}
              <View style={styles.actionBlock}>
                <View style={[styles.actionCircle, styles.actionCircleEmpty]} />
              </View>
              <View style={styles.actionBlock}>
                <View style={[styles.actionCircle, styles.actionCircleEmpty]} />
              </View>
            </View>
          )}

          {canRemove && (
            <Pressable
              style={({ pressed }) => [styles.removeRow, pressed && styles.removeRowPressed]}
              onPress={() => setConfirmOpen(true)}
            >
              <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
              <Text style={styles.removeText}>Remove from group</Text>
            </Pressable>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}

      <ConfirmSheet
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Remove ${member?.user.username}?`}
        body="They'll lose access to this group's messages."
        confirmLabel="Remove"
        onConfirm={onConfirmRemove}
        busy={removing}
      />
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
  container: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
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
  roleBadge: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  actionRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-around",
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  actionBlock: { alignItems: "center", gap: spacing.xs, minWidth: 72 },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCircleEmpty: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderLight },
  actionLabel: { fontSize: fontSize.sm, color: colors.text },
  removeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  removeRowPressed: { backgroundColor: colors.chipBackground },
  removeText: { fontSize: fontSize.md, color: colors.danger, fontWeight: "600" },
  error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.lg },
});
