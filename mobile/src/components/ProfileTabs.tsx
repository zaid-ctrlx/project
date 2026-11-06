import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { bookmarkEvent, Event, listUserEvents, unbookmarkEvent } from "../api/events";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, spacing } from "../theme";
import EventCard from "./EventCard";

type TabKey = "hosted" | "communities" | "attended";

const TABS: { key: TabKey; label: string; empty: string }[] = [
  { key: "hosted", label: "Hosting", empty: "Nothing hosted yet." },
  { key: "communities", label: "Communities", empty: "You haven't joined any communities yet." },
  { key: "attended", label: "Attended", empty: "Events you've been to will show up here." },
];

type Props = {
  userId: string;
  /** Own profile shows all three tabs; someone else's shows just "Hosting". */
  isOwn: boolean;
};

// The list section under a profile's stats row. Each tab loads the first
// time it's opened and is kept, so flipping back and forth doesn't refetch.
// Rows reuse the compact EventCard Discover uses.
export default function ProfileTabs({ userId, isOwn }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const tabs = isOwn ? TABS : TABS.slice(0, 1);
  const [active, setActive] = useState<TabKey>("hosted");
  const [data, setData] = useState<Partial<Record<TabKey, Event[]>>>({});
  const [failed, setFailed] = useState<Partial<Record<TabKey, boolean>>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const requested = useRef<Set<string>>(new Set());

  const { styles, colors } = useThemedStyles((colors) => ({
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.lg },
    tab: { paddingVertical: spacing.md, marginRight: spacing.xl },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent, marginBottom: -1 },
    tabText: { fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
    tabTextActive: { color: colors.text },
    title: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
    empty: { textAlign: "center", color: colors.textFaint, fontSize: fontSize.base, paddingVertical: spacing.xl },
  }));

  const load = useCallback(
    async (tab: TabKey) => {
      try {
        const list = await listUserEvents(userId, tab);
        setData((d) => ({ ...d, [tab]: list }));
        setFailed((f) => ({ ...f, [tab]: false }));
      } catch {
        setFailed((f) => ({ ...f, [tab]: true }));
        requested.current.delete(`${userId}:${tab}`);
      }
    },
    [userId]
  );

  useEffect(() => {
    const key = `${userId}:${active}`;
    if (requested.current.has(key)) return;
    requested.current.add(key);
    load(active);
  }, [active, userId, load]);

  async function toggleBookmark(event: Event) {
    if (busyIds.has(event.id)) return;
    const next = !event.is_bookmarked;
    const patch = (value: boolean) =>
      setData((d) =>
        Object.fromEntries(
          Object.entries(d).map(([k, list]) => [k, list?.map((e) => (e.id === event.id ? { ...e, is_bookmarked: value } : e))])
        )
      );
    setBusyIds((s) => new Set(s).add(event.id));
    patch(next);
    try {
      await (next ? bookmarkEvent(event.id) : unbookmarkEvent(event.id));
    } catch {
      patch(!next);
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(event.id);
        return n;
      });
    }
  }

  const current = TABS.find((t) => t.key === active)!;
  const list = data[active];

  return (
    <View>
      {isOwn ? (
        <View style={styles.tabBar}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setActive(t.key)}
              style={[styles.tab, active === t.key && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active === t.key }}
            >
              <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.title}>Hosting</Text>
      )}

      {list === undefined && !failed[active] ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginVertical: spacing.xl }} />
      ) : failed[active] ? (
        <Pressable onPress={() => { requested.current.add(`${userId}:${active}`); load(active); }}>
          <Text style={styles.empty}>Couldn't load this. Tap to retry.</Text>
        </Pressable>
      ) : list && list.length > 0 ? (
        list.map((event) => (
          <EventCard
            key={event.id}
            compact
            event={event}
            onPress={(e) => openEventDetail(navigation, e)}
            onToggleBookmark={toggleBookmark}
            bookmarkBusy={busyIds.has(event.id)}
          />
        ))
      ) : (
        <Text style={styles.empty}>{current.empty}</Text>
      )}
    </View>
  );
}
