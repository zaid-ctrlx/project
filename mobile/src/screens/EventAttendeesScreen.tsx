import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { mediaUrl } from "../api/client";
import { EventCreator, listEventAttendees } from "../api/events";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

// Organizer-only ("Manage event" on EventDetailScreen) — who has RSVP'd,
// mirrors GroupInfoScreen's member list but simpler: no roles/mute/add,
// just the list itself, since RSVP has no admin concept to manage. Server
// 403s for anyone but the creator (see GET /events/{id}/attendees), so this
// screen is only ever reachable by them in the first place.
export default function EventAttendeesScreen() {
  const { eventId, eventTitle } = useRoute<RouteProp<AppStackParamList, "EventAttendees">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [attendees, setAttendees] = useState<EventCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    headerSpacer: { width: 26 },
    spinner: { marginTop: spacing.xl },
    error: { color: colors.danger, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.xl },
    list: { paddingBottom: spacing.xxl },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    avatarSm: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImageSm: { width: 44, height: 44, borderRadius: 22 },
    avatarSmText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    name: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
    empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl, fontSize: fontSize.base },
  }));

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        setAttendees(await listEventAttendees(eventId));
      } catch {
        setError("Couldn't load attendees.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [eventId]
  );

  // Refetches on every focus — same reasoning as GroupInfoScreen: someone
  // could've cancelled their RSVP one screen since this last loaded.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {eventTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} />
      ) : (
        <FlatList
          data={attendees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              {attendees.length} {attendees.length === 1 ? "Attendee" : "Attendees"}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate("UserProfile", { userId: item.id })}
            >
              {item.avatar_url ? (
                <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImageSm} />
              ) : (
                <View style={styles.avatarSm}>
                  <Text style={styles.avatarSmText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.name}>
                <Text style={styles.username} numberOfLines={1}>
                  {item.username}
                </Text>
                {item.full_name && (
                  <Text style={styles.fullName} numberOfLines={1}>
                    {item.full_name}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{error ?? "No one has RSVP'd yet."}</Text>}
        />
      )}
    </View>
  );
}
