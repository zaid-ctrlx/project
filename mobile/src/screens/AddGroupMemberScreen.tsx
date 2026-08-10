import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { addGroupMember, ChatGroup, getGroup } from "../api/groups";
import { UserSearchResult } from "../api/profile";
import Button from "../components/Button";
import UserMultiPicker from "../components/UserMultiPicker";
import type { AppStackParamList } from "../navigation/AppStack";
import { colors, fontSize, spacing } from "../theme";

// Reachable only from GroupChatScreen's header, which only shows the
// entry point to admins — but that's a UI nicety, not the real gate: the
// backend 403s a non-admin's add-member call regardless (see
// routes/groups.py), so there's nothing to re-check here.
export default function AddGroupMemberScreen() {
  const { groupId } = useRoute<RouteProp<AppStackParamList, "AddGroupMember">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await getGroup(groupId);
        if (!cancelled) setGroup(g);
      } catch {
        if (!cancelled) setError("Couldn't load this group.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function onAdd() {
    if (picked.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      for (const user of picked) {
        await addGroupMember(groupId, user.id);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add member(s). Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Members</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <UserMultiPicker
            selected={picked}
            onChange={setPicked}
            excludeIds={group?.members.map((m) => m.user.id) ?? []}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Add to group" onPress={onAdd} loading={saving} disabled={picked.length === 0} />
        </ScrollView>
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
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.base },
});
