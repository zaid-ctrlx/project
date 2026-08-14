import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, mediaUrl } from "../api/client";
import { bookmarkEvent, deleteEvent, Event, joinCommunity, leaveCommunity, unbookmarkEvent } from "../api/events";
import { getGroup, setGroupMuted } from "../api/groups";
import Button from "../components/Button";
import ConfirmDeleteSheet from "../components/ConfirmDeleteSheet";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

// The "entire detail / broader info" screen a community card's second tap
// opens (see EventCard's expand-then-open behavior on Discover). Structured
// like GroupInfoScreen's identity block (circular photo, centered name,
// member count) since a community's "cover image" is deliberately a
// profile-picture crop (1:1, see EventForm) rather than the 16:9 banner
// events get — the two post kinds read as visually distinct on purpose.
// Member management (viewing/removing people) deliberately isn't
// duplicated here — "View / manage members" hands off to the existing
// GroupInfoScreen for the linked group, which already has all of that.
// What else belongs on this screen (richer detail) is still TBD; this is
// the minimal version that makes join/leave, member removal, and deleting
// the community itself real.
export default function CommunityProfileScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "CommunityProfile">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // null until fetched — the mute toggle only appears once we know the
  // current state (see the effect below), rather than guessing "off" while
  // loading, since guessing wrong would flash the switch to the wrong
  // position for a moment.
  const [muted, setMuted] = useState<boolean | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
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
    identity: { alignItems: "center", paddingVertical: spacing.lg },
    avatarImage: { width: 112, height: 112, borderRadius: 56 },
    avatarPlaceholder: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.md, textAlign: "center" },
    memberCount: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
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
    actions: { gap: spacing.sm, marginTop: spacing.sm },
    muteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    muteLabelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    muteText: { fontSize: fontSize.base, color: colors.text, fontWeight: "600" },
    error: { color: colors.danger, fontSize: fontSize.base },
    creator: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.md, textAlign: "center" },
    dangerZone: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight },
  }));

  // Membership (and its mute flag) isn't carried on Event itself — only
  // fetched here, lazily, once joined. Not folded into the initial load
  // since this screen usually opens via EventCard's already-fetched Event
  // (see this file's top comment), and GET /groups/{id} 404s for
  // non-members anyway.
  useEffect(() => {
    if (!event.is_joined || !event.group_id || !currentUser) {
      setMuted(null);
      return;
    }
    let cancelled = false;
    getGroup(event.group_id)
      .then((group) => {
        if (cancelled) return;
        const mine = group.members.find((m) => m.user.id === currentUser.id);
        setMuted(mine?.muted ?? false);
      })
      .catch(() => {
        // Non-fatal — the toggle just stays hidden until it loads.
      });
    return () => {
      cancelled = true;
    };
  }, [event.is_joined, event.group_id, currentUser]);

  async function onToggleMute() {
    if (!event.group_id || muted === null) return;
    const next = !muted;
    setMuteBusy(true);
    setMuted(next);
    try {
      await setGroupMuted(event.group_id, next);
    } catch {
      setMuted(!next);
    } finally {
      setMuteBusy(false);
    }
  }

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

  async function toggleJoin() {
    setError(null);
    setJoinBusy(true);
    try {
      setEvent(event.is_joined ? await leaveCommunity(event.id) : await joinCommunity(event.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setJoinBusy(false);
    }
  }

  async function onConfirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      navigation.goBack();
    } catch (err) {
      setDeleteOpen(false);
      setError(err instanceof ApiError ? err.message : "Couldn't delete this community. Try again.");
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
        <Text style={styles.headerTitle}>Community</Text>
        <Pressable onPress={toggleBookmark} disabled={bookmarkBusy} hitSlop={12}>
          <Ionicons
            name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
            size={24}
            color={event.is_bookmarked ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identity}>
          {event.cover_image_url ? (
            <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="people" size={40} color={colors.textMuted} />
            </View>
          )}
          <Text style={styles.name}>{event.title}</Text>
          <Text style={styles.memberCount}>
            {event.member_count} {event.member_count === 1 ? "member" : "members"}
          </Text>
        </View>

        {event.location_label && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={colors.textMuted} />
            <Text style={styles.metaText}>{event.location_label}</Text>
          </View>
        )}
        {event.frequency && (
          <View style={styles.metaRow}>
            <Ionicons name="repeat-outline" size={18} color={colors.textMuted} />
            <Text style={styles.metaText}>Repeats {FREQUENCY_LABELS[event.frequency].toLowerCase()}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
          <Text style={styles.metaText}>{JOIN_POLICY_LABELS[event.join_policy]}</Text>
        </View>

        {event.description && (
          <View style={styles.metaBlock}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Button
            label={event.is_joined ? "Leave community" : "Join community"}
            onPress={toggleJoin}
            loading={joinBusy}
            variant={event.is_joined ? "secondary" : "primary"}
          />
          {event.is_joined && event.group_id && (
            <Button
              label="Open group chat"
              variant="secondary"
              onPress={() =>
                navigation.navigate("GroupChat", {
                  groupId: event.group_id!,
                  groupName: event.title,
                  memberCount: event.member_count,
                })
              }
            />
          )}
          {/* GET /groups/{id} 404s for non-members server-side, so this only
              makes sense to offer once you've actually joined. */}
          {event.is_joined && event.group_id && (
            <Button
              label="View / manage members"
              variant="secondary"
              onPress={() => navigation.navigate("GroupInfo", { groupId: event.group_id! })}
            />
          )}
          {event.is_joined && muted !== null && (
            <View style={styles.muteRow}>
              <View style={styles.muteLabelWrap}>
                <Ionicons
                  name={muted ? "notifications-off-outline" : "notifications-outline"}
                  size={18}
                  color={colors.textMuted}
                />
                <Text style={styles.muteText}>Mute notifications</Text>
              </View>
              <Switch value={muted} onValueChange={onToggleMute} disabled={muteBusy} trackColor={{ true: colors.primary }} />
            </View>
          )}
        </View>

        <Text style={styles.creator}>Organized by {event.creator.username}</Text>

        {isCreator && (
          <View style={styles.dangerZone}>
            <Button label="Delete community" onPress={() => setDeleteOpen(true)} danger />
          </View>
        )}
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
