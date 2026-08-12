import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { deleteAccount } from "../api/profile";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

// Reached from Settings' "Delete account" row. Two-field confirmation
// before the destructive call: retyping the username is friction against a
// mis-tap (there's nothing to "undo" once this succeeds — every table
// cascades off the user row, see backend's delete_account), and the
// password is the actual server-side authorization check.
export default function DeleteAccountScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    warningBlock: {
      backgroundColor: colors.chipBackground,
      borderRadius: spacing.sm,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    warningTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.danger },
    warningBody: { fontSize: fontSize.base, color: colors.textMuted, lineHeight: 20 },
    fieldLabel: { fontSize: fontSize.base, color: colors.text, fontWeight: "600", marginTop: spacing.sm },
    hint: { fontSize: fontSize.sm, color: colors.textFaint },
    error: { color: colors.danger, fontSize: fontSize.base },
  }));

  if (!user) return null;

  const usernameMatches = usernameInput.trim() === user.username;
  const canSubmit = usernameMatches && password.length > 0 && !submitting;

  async function onDelete() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount(password);
      await logout();
      // No further navigation needed — App.tsx's RootNavigator swaps to
      // Login the moment AuthContext's user goes null, same as a normal
      // logout (see SettingsScreen's confirmLogout).
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.warningBlock}>
          <Text style={styles.warningTitle}>This can't be undone</Text>
          <Text style={styles.warningBody}>
            Deleting your account permanently removes your profile, posts, messages, and group memberships. There's
            no way to recover it afterward.
          </Text>
        </View>

        <Text style={styles.fieldLabel}>Type your username to confirm</Text>
        <Text style={styles.hint}>@{user.username}</Text>
        <TextField
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={usernameInput}
          onChangeText={setUsernameInput}
        />

        <Text style={styles.fieldLabel}>Enter your password</Text>
        <TextField placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button label="Delete my account" onPress={onDelete} loading={submitting} disabled={!canSubmit} danger />
      </ScrollView>
    </View>
  );
}
