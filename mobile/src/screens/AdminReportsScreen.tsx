import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { AdminReport, listAdminReports, setReportStatus } from "../api/admin";
import { getEvent } from "../api/events";
import { REPORT_REASON_LABELS } from "../api/reports";
import SlidingSegment from "../components/SlidingSegment";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { openEventDetail } from "../navigation/openEventDetail";
import { fontSize, radius, spacing } from "../theme";

// Moderator-only (Settings shows the row only to admins; the server also
// refuses everyone else). Lists reports, lets you open the reported user/post
// and mark a report handled or reopen it.
export default function AdminReportsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    segment: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs },
    reason: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    target: { fontSize: fontSize.base, color: colors.primary, fontWeight: "600" },
    meta: { fontSize: fontSize.sm, color: colors.textMuted },
    details: { fontSize: fontSize.sm, color: colors.text, fontStyle: "italic" },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    btn: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
    btnText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
    status: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
  }));

  const load = useCallback(
    async (which: "open" | "resolved") => {
      setLoading(true);
      setError(null);
      try {
        setReports(await listAdminReports(which));
      } catch {
        setError("Couldn't load reports.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab])
  );

  async function toggle(r: AdminReport) {
    setBusyId(r.id);
    try {
      await setReportStatus(r.id, r.status === "open" ? "resolved" : "open");
      setReports((prev) => prev.filter((x) => x.id !== r.id)); // it moves to the other tab
    } catch {
      setError("Couldn't update that report.");
    } finally {
      setBusyId(null);
    }
  }

  async function openTarget(r: AdminReport) {
    try {
      if (r.target_type === "user") {
        navigation.navigate("UserProfile", { userId: r.target_id });
      } else {
        openEventDetail(navigation, await getEvent(r.target_id));
      }
    } catch {
      setError("That post can't be opened (it may be deleted).");
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.headerSpacer} />
      </View>
      <SlidingSegment
        style={styles.segment}
        options={[
          { key: "open", label: "Open" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={error ? <Text style={styles.status}>{error}</Text> : undefined}
          ListEmptyComponent={<Text style={styles.status}>{tab === "open" ? "No open reports." : "Nothing resolved yet."}</Text>}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              <Text style={styles.reason}>{REPORT_REASON_LABELS[r.reason]}</Text>
              <Pressable onPress={() => openTarget(r)} disabled={!r.target_label}>
                <Text style={styles.target}>
                  {r.target_type === "user" ? "User " : r.target_kind === "community" ? "Community " : "Event "}
                  {r.target_label ?? "(deleted)"}
                </Text>
              </Pressable>
              {r.details ? <Text style={styles.details}>"{r.details}"</Text> : null}
              <Text style={styles.meta}>
                by @{r.reporter_username ?? "deleted"} · {new Date(r.created_at).toLocaleString()}
                {r.target_report_count > 1 ? ` · ${r.target_report_count} reports on this target` : ""}
              </Text>
              <View style={styles.actions}>
                <Pressable style={styles.btn} onPress={() => toggle(r)} disabled={busyId === r.id}>
                  <Text style={styles.btnText}>{r.status === "open" ? "Mark resolved" : "Reopen"}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
