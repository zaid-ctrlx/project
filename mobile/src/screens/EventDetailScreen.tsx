import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "../api/client";
import { bookmarkEvent, Event, unbookmarkEvent } from "../api/events";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_ICONS, JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Receives the event object straight from the list it was opened from
// (Discover/Bookmarks already fetched it fresh) rather than refetching by
// id — there's no GET /events/{id} endpoint, and this data is seconds old.
// Bookmark toggles here are local to this screen; the originating list
// picks up the change next time it remounts, same as everywhere else.
export default function EventDetailScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "EventDetail">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    cover: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.chipBackground },
    title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    metaText: { fontSize: fontSize.base, color: colors.textMuted },
    metaBlock: { marginTop: spacing.sm },
    sectionTitle: {
      fontSize: fontSize.base,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    description: { fontSize: fontSize.base, color: colors.text, lineHeight: 20 },
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
    creator: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.md },
  }));

  async function toggleBookmark() {
    const next = !event.is_bookmarked;
    setBookmarkBusy(true);
    setEvent((prev) => ({ ...prev, is_bookmarked: next }));
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      setEvent((prev) => ({ ...prev, is_bookmarked: !next }));
    } finally {
      setBookmarkBusy(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{EVENT_KIND_LABELS[event.kind]}</Text>
        <Pressable onPress={toggleBookmark} disabled={bookmarkBusy} hitSlop={12}>
          <Ionicons
            name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
            size={24}
            color={event.is_bookmarked ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {event.cover_image_url && (
          <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.cover} resizeMode="cover" />
        )}

        <Text style={styles.title}>{event.title}</Text>

        {event.kind === "event" && event.starts_at ? (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={18} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatDateTime(event.starts_at)}</Text>
          </View>
        ) : (
          event.frequency && (
            <View style={styles.metaRow}>
              <Ionicons name="repeat-outline" size={18} color={colors.textMuted} />
              <Text style={styles.metaText}>Repeats {FREQUENCY_LABELS[event.frequency].toLowerCase()}</Text>
            </View>
          )
        )}

        {event.location_label && (
          <View style={styles.metaRow}>
            <Ionicons name={event.is_online ? "globe-outline" : "location-outline"} size={18} color={colors.textMuted} />
            <Text style={styles.metaText}>{event.location_label}</Text>
          </View>
        )}

        {event.kind === "community" && (
          <View style={styles.metaRow}>
            <Ionicons name={JOIN_POLICY_ICONS[event.join_policy]} size={18} color={colors.textMuted} />
            <Text style={styles.metaText}>{JOIN_POLICY_LABELS[event.join_policy]}</Text>
          </View>
        )}

        {event.description && (
          <View style={styles.metaBlock}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {event.activity_type && (
          <View style={styles.metaBlock}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.tagRow}>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>{ACTIVITY_TYPE_LABELS[event.activity_type]}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.creator}>Organized by {event.creator.username}</Text>
      </ScrollView>
    </View>
  );
}
