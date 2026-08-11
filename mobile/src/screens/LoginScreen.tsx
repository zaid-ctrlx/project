import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ApiError } from "../api/client";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { styles } = useThemedStyles((colors) => ({
    container: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
    title: { fontSize: fontSize.xxl, fontWeight: "700", marginBottom: spacing.xl, color: colors.text },
    field: { marginBottom: spacing.md },
    error: { color: colors.danger, marginBottom: spacing.md, fontSize: fontSize.base },
    link: { color: colors.text, marginTop: spacing.lg, textAlign: "center", textDecorationLine: "underline" },
  }));

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>

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
        <TextField placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.field}>
        <Button label="Log in" onPress={onSubmit} loading={submitting} />
      </View>

      <Pressable onPress={() => navigation.navigate("Register")} hitSlop={8}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </Pressable>
    </View>
  );
}
