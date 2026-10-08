import React from "react";
import { Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import ProfileForm from "../components/ProfileForm";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";

export default function OnboardingScreen() {
  const { setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { styles } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl },
    title: { fontSize: fontSize.xxl, fontWeight: "700", marginBottom: spacing.xs, color: colors.text },
    subtitle: { fontSize: fontSize.base, color: colors.textMuted },
  }));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>This helps us recommend relevant events near you.</Text>
      </View>
      <ProfileForm submitLabel="Continue" onSaved={setUser} />
    </View>
  );
}
