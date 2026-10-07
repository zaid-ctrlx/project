import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import { Event } from "../api/events";
import { EVENT_KIND_ICONS, EVENT_KIND_LABELS } from "../constants/eventKind";
import { ACTIVITY_TYPE_LABELS } from "../constants/eventTags";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { formatDistance } from "../lib/geo";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";

type Props = {
  event: Event;
  onPress: (event: Event) => void;
  onToggleBookmark: (event: Event) => void;
  bookmarkBusy?: boolean;
  // Community-only, and opt-in per call site: when provided, tapping a
  // community card expands it in place first (full description + a
  // Join/Leave button) instead of calling onPress immediately; a second tap
  // on the already-expanded card then calls onPress (Discover routes that
  // to CommunityProfileScreen — see openEventDetail). Event cards always
  // call onPress on the first tap regardless. Omitting this prop (as
  // Bookmarks/My Posts do) keeps every card single-tap.
  onToggleJoin?: (event: Event) => void;
  joinBusy?: boolean;
  // Dense list-row layout (thumbnail left, details right) used by Discover;
  // the default tall cover card is for Home-style feeds.
  compact?: boolean;
  // Straight-line distance from the user's chosen location, when known.
  distanceKm?: number | null;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${time}`;
}

// Activity card from the Huddle design: cover (or violet gradient fallback)
// fading into the card surface, category pill + glass bookmark button on the
// cover, a "when" badge, then title/location/description and a footer with
// the going / member count. Reused by Discover, Bookmarks, and My Posts.
export default function EventCard({
  event,
  onPress,
  onToggleBookmark,
  bookmarkBusy,
  onToggleJoin,
  joinBusy,
  compact,
  distanceKm,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = event.kind === "community" && !!onToggleJoin;

  const { styles, colors } = useThemedStyles((colors) => ({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
      marginBottom: spacing.lg,
    },
    cardPressed: { borderColor: colors.textFaint },
    accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 3 },
    media: { width: "100%", height: 150, justifyContent: "flex-end" },
    mediaImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    mediaFallback: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    topRow: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    // Kind badge: outlined in the kind's accent so Event vs Community is
    // readable before any text is.
    kindPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      borderWidth: 1,
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.scrim,
    },
    kindPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
    glassButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.scrim,
      alignItems: "center",
      justifyContent: "center",
    },
    whenBadge: {
      position: "absolute",
      left: spacing.md,
      bottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.scrim,
    },
    whenText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
    content: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
    category: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
    meta: { fontSize: fontSize.sm, color: colors.textMuted },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    description: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
    },
    footerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    going: { fontSize: fontSize.sm, fontWeight: "700" },
    expandChevron: { alignSelf: "center", marginTop: spacing.sm },
    expandedBlock: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    expandedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    // Compact row layout
    rowCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    rowMain: { flexDirection: "row", gap: spacing.md },
    thumb: {
      width: 92,
      height: 92,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
    rowBody: { flex: 1, justifyContent: "space-between" },
    rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    kicker: { flexShrink: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
    kickerCategory: { fontWeight: "600", color: colors.textMuted },
    rowTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text, letterSpacing: -0.2, marginTop: 2 },
    rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    rowMetaText: { flexShrink: 1, fontSize: fontSize.sm, color: colors.textMuted },
    rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    goingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.pill,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
    },
    goingPillText: { fontSize: 12, fontWeight: "700" },
    policyText: { fontSize: 12, color: colors.textFaint },
  }));

  function handleCardPress() {
    if (isExpandable && !expanded) {
      setExpanded(true);
      return;
    }
    onPress(event);
  }

  const isEvent = event.kind === "event";
  const when = event.starts_at ? formatWhen(event.starts_at) : null;
  const count = isEvent ? event.attendee_count : event.member_count;

  // Events are orange + calendar + squared corners; communities are teal +
  // people + fully round shapes — the cues that make the two kinds
  // distinguishable at a glance (see also the map markers, same colours).
  const accent = isEvent ? colors.primary : colors.community;
  const accentSoft = isEvent ? colors.primarySoft : colors.communitySoft;
  const kindLabel = EVENT_KIND_LABELS[event.kind];
  const kindIcon = EVENT_KIND_ICONS[event.kind];
  const badgeRadius = isEvent ? radius.sm : radius.pill;
  const categoryLabel = event.activity_type ? ACTIVITY_TYPE_LABELS[event.activity_type] : null;
  const repeatsLabel = event.frequency ? `Repeats ${FREQUENCY_LABELS[event.frequency].toLowerCase()}` : null;
  // "When" line: a date for events, the repeat cadence for communities.
  const whenLine = isEvent ? when : repeatsLabel;
  const whenIcon = isEvent ? "time-outline" : "repeat";
  const countLabel = `${count} ${isEvent ? "going" : count === 1 ? "member" : "members"}`;
  const countColor = isEvent ? colors.success : colors.community;
  const countSoft = isEvent ? colors.successSoft : colors.communitySoft;
  const countIcon = isEvent ? "checkmark-circle" : "people";
  const locationText = event.location_label
    ? distanceKm != null && !event.is_online
      ? `${event.location_label} · ${formatDistance(distanceKm)}`
      : event.location_label
    : null;

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.rowCard, { borderLeftColor: accent }, pressed && styles.cardPressed]}
        onPress={handleCardPress}
      >
        <View style={styles.rowMain}>
          <View
            style={[
              styles.thumb,
              { backgroundColor: accentSoft, borderRadius: isEvent ? radius.md : 46 },
            ]}
          >
            {event.cover_image_url ? (
              <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <Ionicons name={kindIcon} size={32} color={accent} />
            )}
          </View>
          <View style={styles.rowBody}>
            <View>
              <View style={styles.rowTop}>
                <Text style={[styles.kicker, { color: accent }]} numberOfLines={1}>
                  {kindLabel}
                  {categoryLabel ? <Text style={styles.kickerCategory}>{` · ${categoryLabel}`}</Text> : null}
                </Text>
                <Pressable onPress={() => onToggleBookmark(event)} disabled={bookmarkBusy} hitSlop={10}>
                  <Ionicons
                    name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={event.is_bookmarked ? accent : colors.textFaint}
                  />
                </Pressable>
              </View>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {event.title}
              </Text>
              {whenLine && (
                <View style={styles.rowMeta}>
                  <Ionicons name={whenIcon} size={14} color={accent} />
                  <Text style={styles.rowMetaText} numberOfLines={1}>
                    {whenLine}
                  </Text>
                </View>
              )}
              {event.location_label && (
                <View style={styles.rowMeta}>
                  <Ionicons name={event.is_online ? "globe-outline" : "location-outline"} size={14} color={colors.textFaint} />
                  <Text style={styles.rowMetaText} numberOfLines={1}>
                    {locationText}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.rowFooter}>
          <View style={[styles.goingPill, { backgroundColor: countSoft }]}>
            <Ionicons name={countIcon} size={13} color={countColor} />
            <Text style={[styles.goingPillText, { color: countColor }]}>{countLabel}</Text>
          </View>
          <Text style={styles.policyText}>
            {isEvent ? JOIN_POLICY_LABELS[event.join_policy] : FREQUENCY_LABELS[event.frequency ?? "irregular"]}
          </Text>
        </View>
        {isExpandable && expanded && (
          <View style={styles.expandedBlock}>
            {event.description && <Text style={styles.description}>{event.description}</Text>}
            <Button
              label={event.is_joined ? "Leave community" : "Join community"}
              onPress={() => onToggleJoin!(event)}
              loading={joinBusy}
              variant={event.is_joined ? "secondary" : "primary"}
            />
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={handleCardPress}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={[styles.media, { backgroundColor: accentSoft }]}>
        {event.cover_image_url ? (
          <Image source={{ uri: mediaUrl(event.cover_image_url)! }} style={styles.mediaImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[accentSoft, colors.surfaceElevated]} style={styles.mediaFallback}>
            <Ionicons name={kindIcon} size={48} color={accent} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={["transparent", colors.surface]}
          locations={[0.35, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />
        <View style={styles.topRow}>
          <View style={[styles.kindPill, { borderColor: accent, borderRadius: badgeRadius }]}>
            <Ionicons name={kindIcon} size={13} color={accent} />
            <Text style={[styles.kindPillText, { color: accent }]}>{kindLabel}</Text>
          </View>
          <Pressable
            onPress={() => onToggleBookmark(event)}
            disabled={bookmarkBusy}
            hitSlop={8}
            style={styles.glassButton}
          >
            <Ionicons
              name={event.is_bookmarked ? "bookmark" : "bookmark-outline"}
              size={18}
              color={event.is_bookmarked ? accent : "#faf6f1"}
            />
          </Pressable>
        </View>
        {whenLine && (
          <View style={[styles.whenBadge, { borderColor: accent, borderRadius: badgeRadius }]}>
            <Ionicons name={isEvent ? "calendar-outline" : "repeat"} size={12} color={accent} />
            <Text style={[styles.whenText, { color: accent }]}>{whenLine}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {categoryLabel && <Text style={styles.category}>{categoryLabel}</Text>}
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {event.location_label && (
          <View style={styles.metaRow}>
            <Ionicons name={event.is_online ? "globe-outline" : "location"} size={14} color={accent} />
            <Text style={styles.meta} numberOfLines={1}>
              {locationText}
            </Text>
          </View>
        )}
        {event.description && (
          <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
            {event.description}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Ionicons name={countIcon} size={16} color={countColor} />
            <Text style={[styles.going, { color: countColor }]}>{countLabel}</Text>
          </View>
          <Text style={styles.meta}>
            {isEvent ? JOIN_POLICY_LABELS[event.join_policy] : FREQUENCY_LABELS[event.frequency ?? "irregular"]}
          </Text>
        </View>

        {isExpandable && !expanded && (
          <Ionicons name="chevron-down" size={16} color={colors.textFaint} style={styles.expandChevron} />
        )}

        {isExpandable && expanded && (
          <View style={styles.expandedBlock}>
            {event.frequency && (
              <View style={styles.expandedRow}>
                <Ionicons name="repeat-outline" size={16} color={colors.textMuted} />
                <Text style={styles.meta}>Repeats {FREQUENCY_LABELS[event.frequency].toLowerCase()}</Text>
              </View>
            )}
            <View style={styles.expandedRow}>
              <Ionicons name="people-outline" size={16} color={colors.textMuted} />
              <Text style={styles.meta}>
                {event.member_count} {event.member_count === 1 ? "member" : "members"} ·{" "}
                {JOIN_POLICY_LABELS[event.join_policy]}
              </Text>
            </View>
            <Button
              label={event.is_joined ? "Leave community" : "Join community"}
              onPress={() => onToggleJoin!(event)}
              loading={joinBusy}
              variant={event.is_joined ? "secondary" : "primary"}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}
