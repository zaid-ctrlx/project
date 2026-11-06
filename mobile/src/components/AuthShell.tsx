import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = { title: string; subtitle?: string; children: React.ReactNode };

// Shared frame for Login/Register: a quiet brand mark, the wordmark +
// tagline, then the form content. Deliberately no glow/orb effects — flat
// cream (or navy in dark mode) with one solid violet mark and an orange
// underline keeps it calm and editorial.
export default function AuthShell({ title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles((colors) => ({
    root: { flex: 1, backgroundColor: colors.background },
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
    },
    logoMark: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    wordmarkRule: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.secondary, marginTop: spacing.sm, marginBottom: spacing.md },
    wordmark: { fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -1 },
    tagline: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" },
    taglineAccent: { color: colors.event, fontWeight: "700" },
    title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
    titleGap: { marginBottom: spacing.lg },
  }));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}>
              <Ionicons name="people" size={26} color={colors.primaryText} />
            </View>
          </View>
          <Text style={styles.wordmark}>Huddle</Text>
          <View style={styles.wordmarkRule} />
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
