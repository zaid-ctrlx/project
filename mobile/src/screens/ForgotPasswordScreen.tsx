import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { forgotPassword } from "../api/auth";
import { ApiError } from "../api/client";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { styles } = useThemedStyles((colors) => ({
    field: { marginBottom: spacing.md },
    error: { color: colors.danger, marginBottom: spacing.md, fontSize: fontSize.base },
    link: { color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" },
    linkAccent: { color: colors.primary, fontWeight: "700" },
  }));

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = email.trim();
      await forgotPassword(trimmed);
      navigation.navigate("ResetPassword", { email: trimmed });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we'll send you a 6-digit code.">
      <View style={styles.field}>
        <TextField
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.field}>
        <Button label="Send code" onPress={onSubmit} loading={submitting} disabled={!email.trim()} />
      </View>

      <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
        <Text style={styles.link}>
          <Text style={styles.linkAccent}>Back to log in</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
