import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { Event, listMyPlans } from "../api/events";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { dayHeading, startsInLabel, timeLabel } from "../lib/countdown";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

type Scope = "upcoming" | "past";

// The user's agenda: events they're going to or hosting, grouped by day with a
// "starts in" countdown. Reminders (24h / 6h before) are sent by the backend
// (app/core/reminders.py) and land in Notifications.
export default function MyPlansScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [events, setEvents] = useState<Event[]>([]);
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
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    headerSpacer: { width: 26 },
    tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.inverse, borderColor: colors.inverse },
    tabText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "700" },
    tabTextActive: { color: colors.inverseText },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    card: {
      flexDirection: "row",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    timeCol: { width: 64, alignItems: "center", justifyContent: "center", gap: 2 },
    time: { color: colors.text, fontSize: fontSize.sm, fontWeight: "800" },
    countdown: { color: colors.accent, fontSize: 11, fontWeight: "700", textAlign: "center" },
    body: { flex: 1, gap: 3 },
    title: { color: colors.text, fontSize: fontSize.base, fontWeight: "700" },
    meta: { color: colors.textMuted, fontSize: fontSize.sm },
    badge: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.successSoft,
      marginTop: 2,
    },
    badgeText: { color: colors.success, fontSize: 11, fontWeight: "800" },
    empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700" },
    emptyBody: { color: colors.textMuted, fontSize: fontSize.base, textAlign: "center" },
  }));

  const load = useCallback(
    async (s: Scope, silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        setEvents(await listMyPlans(s));
      } catch {
        setError("Couldn't load your plans. Check your connection and pull down to retry.");
        setEvents([]);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Reload whenever the screen regains focus (e.g. after RSVPing elsewhere).
  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [load, scope])
  );

  const sections = useMemo(() => {
    const out: { title: string; data: Event[] }[] = [];
    for (const e of events) {
      if (!e.starts_at) continue;
      const title = dayHeading(e.starts_at);
      const last = out[out.length - 1];
      if (last && last.title === title) last.data.push(e);
      else out.push({ title, data: [e] });
    }
    return out;
  }, [events]);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Plans</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {(["upcoming", "past"] as Scope[]).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)} style={[styles.tab, scope === s && styles.tabActive]}>
            <Text style={[styles.tabText, scope === s && styles.tabTextActive]}>{s === "upcoming" ? "Upcoming" : "Past"}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              colors={[colors.primary]}
              onRefresh={() => {
                setRefreshing(true);
                load(scope, true);
              }}
            />
          }
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => {
            const hosting = item.creator.id === user?.id;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                onPress={() => openEventDetail(navigation, item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${hosting ? "hosting" : "going"}`}
              >
                <View style={styles.timeCol}>
                  <Text style={styles.time}>{timeLabel(item.starts_at!)}</Text>
                  {scope === "upcoming" ? <Text style={styles.countdown}>{startsInLabel(item.starts_at!)}</Text> : null}
                </View>
                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.location_label ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.location_label}
                    </Text>
                  ) : null}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{hosting ? "Hosting" : "Going"}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>{scope === "upcoming" ? "Nothing planned yet" : "No past events"}</Text>
              <Text style={styles.emptyBody}>
                {error ??
                  (scope === "upcoming"
                    ? "Tap “I'm going” on an event and it shows up here, with a reminder the day before and a few hours ahead."
                    : "Events you went to or hosted will be listed here.")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
