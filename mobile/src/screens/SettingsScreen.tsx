import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import ConfirmSheet from "../components/ConfirmSheet";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
    accountBlock: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    accountLabel: { fontSize: fontSize.sm, color: colors.textFaint },
    accountValue: { fontSize: fontSize.base, color: colors.text, marginTop: spacing.xs },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
    rowBordered: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    rowPressed: { backgroundColor: colors.chipBackground },
    rowText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    logoutText: { fontSize: fontSize.md, fontWeight: "600", color: colors.danger },
  }));

  async function onConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      // No need to close the sheet or reset loggingOut — logout() sets
      // AuthContext's user to null, and App.tsx's RootNavigator swaps away
      // from this screen entirely the moment that happens (same as
      // DeleteAccountScreen's onDelete).
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {user && (
        <View style={styles.accountBlock}>
          <Text style={styles.accountLabel}>Signed in as</Text>
          <Text style={styles.accountValue}>{user.email}</Text>
        </View>
      )}

      <Pressable
        onPress={() => navigation.navigate("MyPosts")}
        style={({ pressed }) => [styles.row, styles.rowBordered, pressed && styles.rowPressed]}
      >
        <Ionicons name="document-text-outline" size={20} color={colors.text} />
        <Text style={styles.rowText}>My Posts</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("Bookmarks")}
        style={({ pressed }) => [styles.row, styles.rowBordered, pressed && styles.rowPressed]}
      >
        <Ionicons name="bookmark-outline" size={20} color={colors.text} />
        <Text style={styles.rowText}>Bookmarks</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("BlockedUsers")}
        style={({ pressed }) => [styles.row, styles.rowBordered, pressed && styles.rowPressed]}
      >
        <Ionicons name="ban-outline" size={20} color={colors.text} />
        <Text style={styles.rowText}>Blocked profiles</Text>
      </Pressable>

      <Pressable
        onPress={() => setLogoutConfirmOpen(true)}
        style={({ pressed }) => [styles.row, styles.rowBordered, pressed && styles.rowPressed]}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("DeleteAccount")}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Text style={styles.logoutText}>Delete account</Text>
      </Pressable>

      <ConfirmSheet
        visible={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Log out"
        body="Are you sure you want to log out?"
        confirmLabel="Log out"
        onConfirm={onConfirmLogout}
        busy={loggingOut}
      />
    </View>
  );
}
