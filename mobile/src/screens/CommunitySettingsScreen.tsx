import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ApiError } from "../api/client";
import { deleteEvent, Event, EventCreatePayload, Frequency, JoinPolicy, updateEvent } from "../api/events";
import Button from "../components/Button";
import ConfirmDeleteSheet from "../components/ConfirmDeleteSheet";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_ICONS, JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

const JOIN_POLICIES: JoinPolicy[] = ["anyone", "admin_approval"];
const FREQUENCIES: Frequency[] = ["daily", "twice_a_week", "once_a_week", "irregular"];

// Admin-only settings for a community, reached from the "Admin tools" card
// on CommunityProfileScreen — so a community's creator can change how it
// runs (who can join, how often it meets) and delete it without detouring
// through Profile > Settings > My Posts. Each choice saves the moment it's
// tapped (PUT /events/{id} is a full replace, so the payload is rebuilt from
// the current community with just that one field swapped). Title,
// description, photo and location live in the full editor ("Edit details").
export default function CommunitySettingsScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "CommunitySettings">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    communityName: { fontSize: fontSize.base, color: colors.textMuted },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.md,
    },
    group: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    optionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    optionPressed: { backgroundColor: colors.chipBackground },
    optionLabel: { flex: 1, fontSize: fontSize.md, color: colors.text },
    hint: { fontSize: fontSize.sm, color: colors.textFaint, lineHeight: 18 },
    error: { color: colors.danger, fontSize: fontSize.base },
    dangerZone: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: spacing.sm },
  }));

  // Full-replace payload with exactly one field changed.
  async function save(patch: Partial<Pick<EventCreatePayload, "join_policy" | "frequency">>) {
    if (saving) return;
    const payload: EventCreatePayload = {
      kind: "community",
      title: event.title,
      description: event.description,
      starts_at: null,
      frequency: event.frequency,
      is_online: false,
      location_lat: event.location_lat,
      location_lng: event.location_lng,
      location_label: event.location_label,
      join_policy: event.join_policy,
      activity_type: null,
      ...patch,
    };
    setSaving(true);
    setError(null);
    try {
      setEvent(await updateEvent(event.id, payload));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that change. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      // The community (and this screen's parent) no longer exists — go
      // straight back to the tabs rather than to its stale profile page.
      navigation.popToTop();
    } catch (err) {
      setDeleteOpen(false);
      setError(err instanceof ApiError ? err.message : "Couldn't delete this community. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Community settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.communityName}>{event.title}</Text>

        <Text style={styles.sectionTitle}>Who can join</Text>
        <View style={styles.group}>
          {JOIN_POLICIES.map((policy, i) => {
            const selected = event.join_policy === policy;
            return (
              <Pressable
                key={policy}
                onPress={() => !selected && save({ join_policy: policy })}
                style={({ pressed }) => [
                  styles.option,
                  i < JOIN_POLICIES.length - 1 && styles.optionBorder,
                  pressed && styles.optionPressed,
                ]}
              >
                <Ionicons name={JOIN_POLICY_ICONS[policy]} size={20} color={colors.textMuted} />
                <Text style={styles.optionLabel}>{JOIN_POLICY_LABELS[policy]}</Text>
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={selected ? colors.primary : colors.textFaint}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Meets</Text>
        <View style={styles.group}>
          {FREQUENCIES.map((freq, i) => {
            const selected = event.frequency === freq;
            return (
              <Pressable
                key={freq}
                onPress={() => !selected && save({ frequency: freq })}
                style={({ pressed }) => [
                  styles.option,
                  i < FREQUENCIES.length - 1 && styles.optionBorder,
                  pressed && styles.optionPressed,
                ]}
              >
                <Ionicons name="repeat-outline" size={20} color={colors.textMuted} />
                <Text style={styles.optionLabel}>{FREQUENCY_LABELS[freq]}</Text>
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={selected ? colors.primary : colors.textFaint}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint}>
          Changes save as soon as you tap. To change the name, description, photo or location, use “Edit details” on the
          community page.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.dangerZone}>
          <Text style={styles.hint}>Deleting removes every member and the group chat history. This can't be undone.</Text>
          <Button label="Delete community" onPress={() => setDeleteOpen(true)} danger />
        </View>
      </ScrollView>

      <ConfirmDeleteSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this community?"
        body="Every member loses their membership and the group chat's entire message history. This can't be undone."
        confirmLabel="Delete community"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
    </View>
  );
}
