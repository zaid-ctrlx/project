import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import FadeInUp from "../components/motion/FadeInUp";
import PressableScale from "../components/motion/PressableScale";
import Skeleton from "../components/motion/Skeleton";
import SlidingSegment from "../components/SlidingSegment";

import { Event, listMyPlans } from "../api/events";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { dayHeading, shortCountdown, startsInLabel, timeLabel } from "../lib/countdown";
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
    tabs: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
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
      borderRadius: 20,
      marginBottom: spacing.sm,
      overflow: "hidden",
    },
    edge: { width: 5 },
    timeCol: { width: 58, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md },
    time: { color: colors.text, fontSize: fontSize.sm, fontWeight: "800" },
    body: { flex: 1, gap: 3, paddingVertical: spacing.md, paddingRight: spacing.md },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    title: { flex: 1, color: colors.text, fontSize: fontSize.base, fontWeight: "800" },
    chip: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: colors.accentSoft },
    chipText: { color: colors.event, fontSize: 11, fontWeight: "800" },
    meta: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: "600" },
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
        <SlidingSegment
          options={[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past" },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingTop: spacing.md }}>
          <Skeleton height={14} width={90} radius={7} />
          <Skeleton height={78} radius={20} />
          <Skeleton height={78} radius={20} />
          <Skeleton height={14} width={110} radius={7} style={{ marginTop: spacing.md }} />
          <Skeleton height={78} radius={20} />
        </View>
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
          renderItem={({ item, index }) => {
            const hosting = item.creator.id === user?.id;
            const edge = item.kind === "community" ? colors.community : colors.event;
            return (
              <FadeInUp index={index}>
                <PressableScale
                  style={styles.card}
                  pressedScale={0.98}
                  onPress={() => openEventDetail(navigation, item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${hosting ? "hosting" : "going"}`}
                >
                  <View style={[styles.edge, { backgroundColor: edge }]} />
                  <View style={styles.timeCol}>
                    <Text style={styles.time}>{timeLabel(item.starts_at!)}</Text>
                  </View>
                  <View style={styles.body}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {scope === "upcoming" ? (
                        <View style={styles.chip}>
                          <Text style={styles.chipText}>{shortCountdown(item.starts_at!)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      {hosting ? "Hosting" : "Going"}
                      {item.location_label ? ` · ${item.location_label.split(",")[0]}` : ""}
                      {scope === "upcoming" ? ` · ${startsInLabel(item.starts_at!)}` : ""}
                    </Text>
                  </View>
                </PressableScale>
              </FadeInUp>
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
