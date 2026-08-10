import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { ApiError } from "../api/client";
import {
  ActivityType,
  CommunityVibe,
  createEvent,
  Event,
  EventStyle,
  JoinPolicy,
  SkillLevel,
  updateEvent,
} from "../api/events";
import {
  ACTIVITY_TYPE_LABELS,
  COMMUNITY_VIBE_LABELS,
  EVENT_STYLE_LABELS,
  labelsToOptions,
  SKILL_LEVEL_LABELS,
} from "../constants/eventTags";
import { JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { colors, fontSize, spacing } from "../theme";
import Button from "./Button";
import DateTimeField from "./DateTimeField";
import LocationPicker, { LocationValue } from "./LocationPicker";
import Select from "./Select";
import TextField from "./TextField";

type Props = {
  // Undefined = create mode (POST /events, blank form). Provided = edit
  // mode (PUT /events/{id}, prefilled from it) — same fields either way,
  // same as ProfileForm's initial*/onSaved shape for user profiles.
  initialEvent?: Event;
  submitLabel: string;
  onSaved: (event: Event) => void;
};

// Select works off the display strings directly (see its one other use,
// ProfileForm's Gender field, where the options already match the backend
// values 1:1) — these fields' backend values are snake_case slugs, so map
// display <-> value here instead of teaching Select about a separate label.
const JOIN_POLICY = labelsToOptions(JOIN_POLICY_LABELS);
const ACTIVITY_TYPE = labelsToOptions(ACTIVITY_TYPE_LABELS);
const COMMUNITY_VIBE = labelsToOptions(COMMUNITY_VIBE_LABELS);
const SKILL_LEVEL = labelsToOptions(SKILL_LEVEL_LABELS);
const EVENT_STYLE = labelsToOptions(EVENT_STYLE_LABELS);

// Shared by Create Event and Edit Event (reached from My Events) — same
// fields, same validation, just different initial values, submit copy, and
// which API call the submit makes.
export default function EventForm({ initialEvent, submitLabel, onSaved }: Props) {
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [joinPolicyLabel, setJoinPolicyLabel] = useState<string>(
    initialEvent ? JOIN_POLICY_LABELS[initialEvent.join_policy] : JOIN_POLICY_LABELS.open
  );
  const [startsAt, setStartsAt] = useState<Date | null>(initialEvent ? new Date(initialEvent.starts_at) : null);
  const [location, setLocation] = useState<LocationValue | null>(
    initialEvent?.location_lat != null && initialEvent?.location_lng != null && initialEvent?.location_label
      ? { lat: initialEvent.location_lat, lng: initialEvent.location_lng, label: initialEvent.location_label }
      : null
  );
  const [activityTypeLabel, setActivityTypeLabel] = useState<string | null>(
    initialEvent?.activity_type ? ACTIVITY_TYPE_LABELS[initialEvent.activity_type] : null
  );
  const [communityVibeLabel, setCommunityVibeLabel] = useState<string | null>(
    initialEvent?.community_vibe ? COMMUNITY_VIBE_LABELS[initialEvent.community_vibe] : null
  );
  const [skillLevelLabel, setSkillLevelLabel] = useState<string | null>(
    initialEvent?.skill_level ? SKILL_LEVEL_LABELS[initialEvent.skill_level] : null
  );
  const [eventStyleLabel, setEventStyleLabel] = useState<string | null>(
    initialEvent?.event_style ? EVENT_STYLE_LABELS[initialEvent.event_style] : null
  );
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
      const payload = {
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
      };
      const saved = initialEvent ? await updateEvent(initialEvent.id, payload) : await createEvent(payload);

      if (!initialEvent) {
        // Create mode only — clear the form for the next entry. Edit mode
        // navigates away instead (see EditEventScreen), so resetting here
        // would just flash empty fields right before that happens.
        setTitle("");
        setDescription("");
        setJoinPolicyLabel(JOIN_POLICY_LABELS.open);
        setStartsAt(null);
        setLocation(null);
        setActivityTypeLabel(null);
        setCommunityVibeLabel(null);
        setSkillLevelLabel(null);
        setEventStyleLabel(null);
      }
      onSaved(saved);
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
      <LocationPicker initialLabel={initialEvent?.location_label} onChange={setLocation} />

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
      <Button label={submitLabel} onPress={onSubmit} loading={saving} />
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
