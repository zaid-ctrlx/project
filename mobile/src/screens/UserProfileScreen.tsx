import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { getUserProfile, PublicProfile } from "../api/profile";
import Button from "../components/Button";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

export default function UserProfileScreen() {
  const { userId } = useRoute<RouteProp<AppStackParamList, "UserProfile">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    spinner: { marginTop: spacing.xl },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
    container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    profileRow: { flexDirection: "row", alignItems: "center" },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.lg,
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40, marginRight: spacing.lg },
    avatarText: { fontSize: 30, fontWeight: "700", color: colors.text },
    identity: { flex: 1 },
    username: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
    fullName: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    bio: { fontSize: fontSize.base, color: colors.text },
    metaBlock: { marginTop: spacing.sm },
    sectionTitle: {
      fontSize: fontSize.base,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tagChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.chipBackground,
    },
    tagChipText: { fontSize: fontSize.sm, color: colors.text },
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getUserProfile(userId);
        if (!cancelled) setProfile(result);
      } catch {
        if (!cancelled) setError("Couldn't load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : !profile ? (
        <Text style={styles.error}>{error ?? "Something went wrong."}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.profileRow}>
            {profile.avatar_url ? (
              <Image source={{ uri: mediaUrl(profile.avatar_url)! }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.identity}>
              <Text style={styles.username}>{profile.username}</Text>
              {profile.full_name && <Text style={styles.fullName}>{profile.full_name}</Text>}
            </View>
          </View>

          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          <Button
            label="Message"
            onPress={() =>
              navigation.navigate("Chat", {
                userId: profile.id,
                username: profile.username,
                avatarUrl: profile.avatar_url,
              })
            }
          />

          {profile.tags.length > 0 && (
            <View style={styles.metaBlock}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.tagRow}>
                {profile.tags.map((tag) => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
