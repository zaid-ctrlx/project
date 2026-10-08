import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import { bookmarkEvent, Event, getEvent, joinCommunity, leaveCommunity, unbookmarkEvent } from "../api/events";
import { getGroup, setGroupMuted } from "../api/groups";
import Button from "../components/Button";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_LABELS, joinButtonIsPrimary, joinButtonLabel } from "../constants/joinPolicy";
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
// the community itself real (the latter now lives in CommunitySettingsScreen,
// reached from the admin-only "Admin tools" card below).
export default function CommunityProfileScreen() {
  const { event: initialEvent } = useRoute<RouteProp<AppStackParamList, "CommunityProfile">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();

  const [event, setEvent] = useState<Event>(initialEvent);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null until fetched — the mute toggle only appears once we know the
  // current state (see the effect below), rather than guessing "off" while
  // loading, since guessing wrong would flash the switch to the wrong
  // position for a moment.
  const [muted, setMuted] = useState<boolean | null>(null);
  const [muteBusy, setMuteBusy] = useState(false);
  // Your role in the community's group chat (null until fetched / if not a
  // member). "admin" is what unlocks the Admin tools card below.
  const [myRole, setMyRole] = useState<"admin" | "member" | null>(null);
  const firstFocus = useRef(true);
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
    pendingNote: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
    requestBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    requestBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primaryText },
    creator: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.md, textAlign: "center" },
    adminCard: {
      marginTop: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    adminHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.communitySoft,
    },
    adminHeaderText: { fontSize: fontSize.base, fontWeight: "700", color: colors.community },
    adminRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    adminRowPressed: { backgroundColor: colors.chipBackground },
    adminRowText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  }));

  // Membership (and its mute flag) isn't carried on Event itself — only
  // fetched here, lazily, once joined. Not folded into the initial load
  // since this screen usually opens via EventCard's already-fetched Event
  // (see this file's top comment), and GET /groups/{id} 404s for
  // non-members anyway.
  useEffect(() => {
    if (!event.is_joined || !event.group_id || !currentUser) {
      setMuted(null);
      setMyRole(null);
      return;
    }
    let cancelled = false;
    getGroup(event.group_id)
      .then((group) => {
        if (cancelled) return;
        const mine = group.members.find((m) => m.user.id === currentUser.id);
        setMuted(mine?.muted ?? false);
        setMyRole(mine?.role ?? null);
      })
      .catch(() => {
        // Non-fatal — the toggle just stays hidden until it loads.
      });
    return () => {
      cancelled = true;
    };
  }, [event.is_joined, event.group_id, currentUser]);

  // Coming back from Edit details / Community settings (or any change made
  // elsewhere) should show the saved values -- refetch on every focus except
  // the first, which already has fresh data from the screen that opened us.
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      getEvent(initialEvent.id)
        .then(setEvent)
        .catch(() => {
          // Non-fatal -- keep showing what we have.
        });
    }, [initialEvent.id])
  );

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
      setEvent(
        event.is_joined || event.has_requested ? await leaveCommunity(event.id) : await joinCommunity(event.id)
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setJoinBusy(false);
    }
  }

  const isCreator = event.creator.id === currentUser?.id;
  const isAdmin = isCreator || myRole === "admin";

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
            label={joinButtonLabel(event)}
            onPress={toggleJoin}
            loading={joinBusy}
            variant={joinButtonIsPrimary(event) ? "primary" : "secondary"}
          />
          {event.has_requested && !event.is_joined && (
            <Text style={styles.pendingNote}>
              Your request is waiting for an admin to approve it. You'll get a notification either way.
            </Text>
          )}
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

        {isAdmin && (
          <View style={styles.adminCard}>
            <View style={styles.adminHeader}>
              <Ionicons name="shield-checkmark" size={18} color={colors.community} />
              <Text style={styles.adminHeaderText}>Admin tools</Text>
            </View>
            {isCreator && (
              <Pressable
                style={({ pressed }) => [styles.adminRow, pressed && styles.adminRowPressed]}
                onPress={() => navigation.navigate("EditEvent", { event })}
              >
                <Ionicons name="create-outline" size={20} color={colors.textMuted} />
                <Text style={styles.adminRowText}>Edit details</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            )}
            {isCreator && (
              <Pressable
                style={({ pressed }) => [styles.adminRow, pressed && styles.adminRowPressed]}
                onPress={() => navigation.navigate("CommunitySettings", { event })}
              >
                <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
                <Text style={styles.adminRowText}>Community settings</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            )}
            {event.join_policy === "admin_approval" && (
              <Pressable
                style={({ pressed }) => [styles.adminRow, pressed && styles.adminRowPressed]}
                onPress={() => navigation.navigate("JoinRequests", { eventId: event.id, eventTitle: event.title })}
              >
                <Ionicons name="person-add-outline" size={20} color={colors.textMuted} />
                <Text style={styles.adminRowText}>Join requests</Text>
                {event.pending_request_count > 0 && (
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>{event.pending_request_count}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            )}
            {event.group_id && (
              <Pressable
                style={({ pressed }) => [styles.adminRow, pressed && styles.adminRowPressed]}
                onPress={() => navigation.navigate("GroupInfo", { groupId: event.group_id! })}
              >
                <Ionicons name="people-outline" size={20} color={colors.textMuted} />
                <Text style={styles.adminRowText}>Manage members</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

    </View>
  );
}
