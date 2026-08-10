import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { ApiError } from "../../api/client";
import { ActivityType, CommunityVibe, createEvent, Event, EventStyle, JoinPolicy, SkillLevel } from "../../api/events";
import Button from "../../components/Button";
import DateTimeField from "../../components/DateTimeField";
import LocationPicker, { LocationValue } from "../../components/LocationPicker";
import Select from "../../components/Select";
import TextField from "../../components/TextField";
import {
  ACTIVITY_TYPE_LABELS,
  COMMUNITY_VIBE_LABELS,
  EVENT_STYLE_LABELS,
  labelsToOptions,
  SKILL_LEVEL_LABELS,
} from "../../constants/eventTags";
import { JOIN_POLICY_LABELS } from "../../constants/joinPolicy";
import { colors, fontSize, spacing } from "../../theme";

type Props = { onCreated: (event: Event) => void };

// Select works off the display strings directly (see its one other use,
// ProfileForm's Gender field, where the options already match the backend
// values 1:1) — these fields' backend values are snake_case slugs, so map
// display <-> value here instead of teaching Select about a separate label.
const JOIN_POLICY = labelsToOptions(JOIN_POLICY_LABELS);
const ACTIVITY_TYPE = labelsToOptions(ACTIVITY_TYPE_LABELS);
const COMMUNITY_VIBE = labelsToOptions(COMMUNITY_VIBE_LABELS);
const SKILL_LEVEL = labelsToOptions(SKILL_LEVEL_LABELS);
const EVENT_STYLE = labelsToOptions(EVENT_STYLE_LABELS);

export default function CreateEventView({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicyLabel, setJoinPolicyLabel] = useState<string>(JOIN_POLICY_LABELS.open);
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [activityTypeLabel, setActivityTypeLabel] = useState<string | null>(null);
  const [communityVibeLabel, setCommunityVibeLabel] = useState<string | null>(null);
  const [skillLevelLabel, setSkillLevelLabel] = useState<string | null>(null);
  const [eventStyleLabel, setEventStyleLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Give your event a title.");
      return;
    }
    if (!startsAt) {
      setError("Pick a date and time.");
      return;
    }
    if (!location) {
      setError("Set a location before continuing.");
      return;
    }

    setSaving(true);
    try {
      const created = await createEvent({
        title: title.trim(),
        description: description.trim() || null,
        starts_at: startsAt.toISOString(),
        location_lat: location.lat,
        location_lng: location.lng,
        location_label: location.label,
        join_policy: JOIN_POLICY.byLabel[joinPolicyLabel] as JoinPolicy,
        activity_type: activityTypeLabel ? (ACTIVITY_TYPE.byLabel[activityTypeLabel] as ActivityType) : null,
        community_vibe: communityVibeLabel ? (COMMUNITY_VIBE.byLabel[communityVibeLabel] as CommunityVibe) : null,
        skill_level: skillLevelLabel ? (SKILL_LEVEL.byLabel[skillLevelLabel] as SkillLevel) : null,
        event_style: eventStyleLabel ? (EVENT_STYLE.byLabel[eventStyleLabel] as EventStyle) : null,
      });
      setTitle("");
      setDescription("");
      setJoinPolicyLabel(JOIN_POLICY_LABELS.open);
      setStartsAt(null);
      setLocation(null);
      setActivityTypeLabel(null);
      setCommunityVibeLabel(null);
      setSkillLevelLabel(null);
      setEventStyleLabel(null);
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>Event Settings</Text>

      <TextField label="Title" placeholder="Event title" value={title} onChangeText={setTitle} maxLength={150} />

      <TextField
        label="Description"
        placeholder="What's this event about?"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        style={styles.descriptionInput}
      />

      <Select
        label="Who can join"
        value={joinPolicyLabel}
        options={JOIN_POLICY.options}
        onChange={setJoinPolicyLabel}
      />

      <DateTimeField label="Date & time" value={startsAt} onChange={setStartsAt} minimumDate={new Date()} />

      <Text style={styles.sectionTitle}>Location</Text>
      <LocationPicker onChange={setLocation} />

      <Text style={styles.sectionTitle}>Tags</Text>
      <Select
        label="🎯 Activity Type"
        placeholder="What are people doing?"
        value={activityTypeLabel}
        options={ACTIVITY_TYPE.options}
        onChange={setActivityTypeLabel}
      />
      <Select
        label="👥 Community Vibe"
        placeholder="What's the vibe?"
        value={communityVibeLabel}
        options={COMMUNITY_VIBE.options}
        onChange={setCommunityVibeLabel}
      />
      <Select
        label="📈 Skill / Experience"
        placeholder="Who's it for?"
        value={skillLevelLabel}
        options={SKILL_LEVEL.options}
        onChange={setSkillLevelLabel}
      />
      <Select
        label="🗓️ Event Style"
        placeholder="How does it run?"
        value={eventStyleLabel}
        options={EVENT_STYLE.options}
        onChange={setEventStyleLabel}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Create event" onPress={onSubmit} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: spacing.xxl, gap: spacing.md },
  descriptionInput: { minHeight: 60, textAlignVertical: "top" },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  firstSectionTitle: { marginTop: 0 },
  error: { color: colors.danger, fontSize: fontSize.base },
});
