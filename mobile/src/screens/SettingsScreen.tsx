import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { colors, fontSize, spacing } from "../theme";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  function confirmLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
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

      <Pressable onPress={confirmLogout} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
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
  row: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  rowPressed: { backgroundColor: colors.chipBackground },
  logoutText: { fontSize: fontSize.md, fontWeight: "600", color: colors.danger },
});
