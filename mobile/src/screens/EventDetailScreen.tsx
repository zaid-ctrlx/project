import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import { bookmarkEvent, cancelRsvp, deleteEvent, Event, rsvpEvent, unbookmarkEvent } from "../api/events";
import Button from "../components/Button";
import ConfirmSheet from "../components/ConfirmSheet";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_ICONS, JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useAuth } from "../context/AuthContext";
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
// id — this data is seconds old. A GET /events/{id} endpoint does exist
// (added for the Discover map's marker preview, see api/events.ts's
// getEvent), but there's no reason for this screen to use it when it
// already has a fresh Event in hand. Bookmark toggles here are local to this
// screen; the originating list picks up the change next time it remounts,
// same as everywhere else.
export default function EventDetailScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "EventDetail">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    actions: { marginTop: spacing.sm, gap: spacing.sm },
    attendeeCount: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
    manageZone: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: spacing.sm },
    manageError: { color: colors.danger, fontSize: fontSize.base },
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

  // Optimistic toggle, same shape as toggleBookmark above — event-only
  // (kind==="community" never reaches this, see the guard on the button
  // below), server 400s if it somehow did.
  async function toggleRsvp() {
    const next = !event.is_rsvped;
    setRsvpBusy(true);
    setEvent((prev) => ({
      ...prev,
      is_rsvped: next,
      attendee_count: prev.attendee_count + (next ? 1 : -1),
    }));
    try {
      setEvent(next ? await rsvpEvent(event.id) : await cancelRsvp(event.id));
    } catch {
      setEvent((prev) => ({
        ...prev,
        is_rsvped: !next,
        attendee_count: prev.attendee_count + (next ? -1 : 1),
      }));
    } finally {
      setRsvpBusy(false);
    }
  }

  async function onConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(event.id);
      navigation.goBack();
    } catch (err) {
      setDeleteOpen(false);
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete this event. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  const isCreator = event.creator.id === currentUser?.id;

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

        {event.kind === "event" && (
          <View style={styles.actions}>
            <Button
              label={event.is_rsvped ? "Going ✓" : "I'm going"}
              onPress={toggleRsvp}
              loading={rsvpBusy}
              variant={event.is_rsvped ? "secondary" : "primary"}
            />
            {event.attendee_count > 0 && (
              <Text style={styles.attendeeCount}>
                {event.attendee_count} {event.attendee_count === 1 ? "person" : "people"} going
              </Text>
            )}
          </View>
        )}

        <Text style={styles.creator}>Organized by {event.creator.username}</Text>

        {isCreator && (
          <View style={styles.manageZone}>
            <Text style={styles.sectionTitle}>Manage event</Text>
            <Button label="Edit event" variant="secondary" onPress={() => navigation.navigate("EditEvent", { event })} />
            <Button
              label={`View attendees${event.attendee_count > 0 ? ` (${event.attendee_count})` : ""}`}
              variant="secondary"
              onPress={() => navigation.navigate("EventAttendees", { eventId: event.id, eventTitle: event.title })}
            />
            {deleteError && <Text style={styles.manageError}>{deleteError}</Text>}
            <Button label="Delete event" onPress={() => setDeleteOpen(true)} danger />
          </View>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete "${event.title}"?`}
        body="This can't be undone — anyone who bookmarked or RSVP'd will lose that too."
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
        busy={deleting}
      />
    </View>
  );
}
