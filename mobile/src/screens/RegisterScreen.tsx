import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ApiError } from "../api/client";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await register(email.trim(), password, fullName.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join communities and events in your city.">

      <View style={styles.field}>
        <TextField placeholder="Full name (optional)" value={fullName} onChangeText={setFullName} />
      </View>
      <View style={styles.field}>
        <TextField
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={styles.field}>
        <TextField
          placeholder="Password (min 8 characters)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.field}>
        <Button label="Register" onPress={onSubmit} loading={submitting} />
      </View>

      <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
        <Text style={styles.link}>
          Already have an account? <Text style={styles.linkAccent}>Log in</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
