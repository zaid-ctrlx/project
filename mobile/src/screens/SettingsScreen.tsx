import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
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

      <Pressable onPress={confirmLogout} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}
