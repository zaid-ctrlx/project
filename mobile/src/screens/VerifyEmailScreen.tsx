import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { resendVerification } from "../api/auth";
import { ApiError } from "../api/client";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import TextField from "../components/TextField";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

const RESEND_SECONDS = 60;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { verifyEmail } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The backend already sent a code on register/login, so start in cooldown.
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const { styles } = useThemedStyles((colors) => ({
    field: { marginBottom: spacing.md },
    code: { textAlign: "center", letterSpacing: 8, fontSize: fontSize.lg },
    error: { color: colors.danger, marginBottom: spacing.md, fontSize: fontSize.base },
    info: { color: colors.textMuted, marginBottom: spacing.md, fontSize: fontSize.base },
    link: { color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" },
    linkAccent: { color: colors.primary, fontWeight: "700" },
  }));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      // On success AuthContext sets the user and the navigator swaps to the
      // signed-in stack, so there's nothing to navigate to here.
      await verifyEmail(email, code.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    try {
      await resendVerification(email);
      setInfo("A new code is on its way.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the code.");
    }
  }

  return (
    <AuthShell title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${email}.`}>
      <View style={styles.field}>
        <TextField
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
          style={styles.code}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <View style={styles.field}>
        <Button label="Verify" onPress={onSubmit} loading={submitting} disabled={code.length !== 6} />
      </View>

      <Pressable onPress={onResend} disabled={cooldown > 0} hitSlop={8}>
        <Text style={styles.link}>
          Didn't get it?{" "}
          <Text style={styles.linkAccent}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</Text>
        </Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
        <Text style={styles.link}>
          <Text style={styles.linkAccent}>Back to log in</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
