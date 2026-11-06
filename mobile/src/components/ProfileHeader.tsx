import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import type { UserStats } from "../api/profile";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

const AVATAR = 96;

type Props = {
  avatarUrl: string | null;
  username: string;
  fullName: string | null;
  bio: string | null;
  /** null while loading; the numbers show as "–" until it arrives. */
  stats: UserStats | null;
  /** Makes the Connections stat tappable (own profile -> connections list). */
  onPressConnections?: () => void;
};

// Shared top of every profile (yours and other people's): centred avatar,
// name, @handle, bio, and one row of headline numbers. Kept deliberately
// small — the screens add their own buttons and interests underneath.
export default function ProfileHeader({ avatarUrl, username, fullName, bio, stats, onPressConnections }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    wrap: { alignItems: "center", paddingTop: spacing.sm },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    avatarImage: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
    avatarText: { fontSize: 38, fontWeight: "700", color: colors.text },
    name: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text, marginTop: spacing.md, textAlign: "center" },
    handle: { fontSize: fontSize.base, color: colors.textMuted, marginTop: 2 },
    bio: { fontSize: fontSize.base, color: colors.text, textAlign: "center", marginTop: spacing.md, lineHeight: 21 },
    stats: {
      flexDirection: "row",
      alignSelf: "stretch",
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
    },
    stat: { flex: 1, alignItems: "center" },
    statDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    statValue: { fontSize: fontSize.lg, fontWeight: "800", color: colors.text },
    statLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  }));

  const items: { label: string; value: number | undefined }[] = [
    { label: "Hosted", value: stats?.hosted },
    { label: "Joined", value: stats?.communities_joined },
    { label: "Attended", value: stats?.events_attended },
    { label: "Connections", value: stats?.connections },
  ];

  return (
    <View style={styles.wrap}>
      {avatarUrl ? (
        <Image source={{ uri: mediaUrl(avatarUrl)! }} style={[styles.avatarImage, { borderWidth: 2, borderColor: colors.primary }]} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <Text style={styles.name} numberOfLines={1}>
        {fullName || username}
      </Text>
      {fullName ? <Text style={styles.handle}>@{username}</Text> : null}
      {bio ? (
        <Text style={styles.bio} numberOfLines={4}>
          {bio}
        </Text>
      ) : null}

      <View style={styles.stats}>
        {items.map((item, i) => {
          const tappable = item.label === "Connections" && onPressConnections;
          return (
            <Pressable
              key={item.label}
              style={[styles.stat, i > 0 && styles.statDivider]}
              onPress={tappable ? onPressConnections : undefined}
              disabled={!tappable}
            >
              <Text style={styles.statValue}>{item.value ?? "–"}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
