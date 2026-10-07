import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = { title: string; subtitle?: string; children: React.ReactNode };

// Shared frame for Login/Register, from the Huddle auth design: soft violet
// and blue "orbs" behind a glowing brand mark, the wordmark + tagline, then
// the form content.
export default function AuthShell({ title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles((colors) => ({
    root: { flex: 1, backgroundColor: colors.background },
    orbA: {
      position: "absolute",
      top: -120,
      alignSelf: "center",
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: colors.primary,
      opacity: 0.18,
    },
    orbB: {
      position: "absolute",
      top: 160,
      right: -90,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.secondary,
      opacity: 0.12,
    },
    content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
    hero: { alignItems: "center", marginBottom: spacing.xl },
    logoWrap: {
      width: 76,
      height: 76,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
      shadowColor: colors.primary,
      shadowOpacity: 0.6,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    logoGradient: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    wordmark: { fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -1 },
    tagline: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
    taglineAccent: { color: colors.primary, fontWeight: "700" },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
    titleGap: { marginBottom: spacing.lg },
  }));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.orbA} pointerEvents="none" />
      <View style={styles.orbB} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoGradient}>
              <Ionicons name="people" size={26} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.wordmark}>Huddle</Text>
          <Text style={styles.tagline}>
            Find your people. Find your activity. <Text style={styles.taglineAccent}>Go do it.</Text>
          </Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : <View style={styles.titleGap} />}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
