import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import { Event, getEvent } from "../api/events";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// An event/community shared into a 1-on-1 chat. Loads the live post (so it is
// never stale) and opens it on tap.
export default function EventShareCard({ eventId }: { eventId: string; mine?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [event, setEvent] = useState<Event | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getEvent(eventId)
      .then((e) => !cancelled && setEvent(e))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const { styles, colors } = useThemedStyles((colors) => ({
    card: { width: 220, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    cover: { width: "100%", height: 110, backgroundColor: colors.chipBackground, alignItems: "center", justifyContent: "center" },
    body: { padding: spacing.sm, gap: 2 },
    kind: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
    title: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    sub: { fontSize: fontSize.sm, color: colors.textMuted },
    missing: { padding: spacing.md, width: 220 },
    loading: { width: 220, height: 110, alignItems: "center", justifyContent: "center" },
  }));

  if (failed) {
    return (
      <View style={styles.missing}>
        <Text style={styles.sub}>This post is no longer available.</Text>
      </View>
    );
  }
  if (!event) {
    return (
      <View style={[styles.card, styles.loading]}>
        <ActivityIndicator />
      </View>
    );
  }
  const cover = mediaUrl(event.cover_image_url);
  const when = event.starts_at
    ? new Date(event.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Recurring community";
  return (
    <Pressable style={styles.card} onPress={() => openEventDetail(navigation, event)} accessibilityRole="button">
      <View style={styles.cover}>
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Ionicons name={event.kind === "community" ? "people" : "calendar"} size={36} color={colors.textFaint} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.kind}>{event.kind === "community" ? "COMMUNITY" : "EVENT"}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {when}
        </Text>
      </View>
    </Pressable>
  );
}
