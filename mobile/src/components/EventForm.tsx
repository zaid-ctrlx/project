import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { ApiError, mediaUrl } from "../api/client";
import {
  ActivityType,
  createEvent,
  Event,
  EventKind,
  Frequency,
  JoinPolicy,
  updateEvent,
  uploadEventCover,
} from "../api/events";
import { ACTIVITY_TYPE_LABELS, labelsToOptions } from "../constants/eventTags";
import { FREQUENCY_LABELS } from "../constants/frequency";
import { JOIN_POLICY_LABELS } from "../constants/joinPolicy";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
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
  // Which kind of post this is — required in create mode (there's no
  // initialEvent to read it from); in edit mode initialEvent.kind wins,
  // since this form has no way to change an existing post's kind.
  kind?: EventKind;
  submitLabel: string;
  onSaved: (event: Event) => void;
};

// Select works off the display strings directly (see its one other use,
// ProfileForm's Gender field, where the options already match the backend
// values 1:1) — these fields' backend values are snake_case slugs, so map
// display <-> value here instead of teaching Select about a separate label.
const ACTIVITY_TYPE = labelsToOptions(ACTIVITY_TYPE_LABELS);
const FREQUENCY = labelsToOptions(FREQUENCY_LABELS);
const JOIN_POLICY = labelsToOptions(JOIN_POLICY_LABELS);

type PickedPhoto = { file: Blob; mimeType: string; previewUri: string };

// Shared by both post kinds and both Create/Edit (reached from My Posts) —
// mostly the same fields, except: events get a cover image + physical/
// online location + a single category, communities get a join-approval
// setting + recurring schedule + an always-physical area. Events are
// flyer/poster-style announcements (no join/attendance mechanism), which is
// why they don't get a "who can join" field at all — see backend
// app/schemas/event.py's EventCreate validator.
export default function EventForm({ initialEvent, kind, submitLabel, onSaved }: Props) {
  const effectiveKind: EventKind = initialEvent?.kind ?? kind ?? "event";
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");

  // --- Cover image (events) / profile picture (communities) ---
  const [coverPhoto, setCoverPhoto] = useState<PickedPhoto | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(mediaUrl(initialEvent?.cover_image_url));
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [coverPicking, setCoverPicking] = useState(false);

  // --- Event-only: date + physical/online location + category ---
  const [startsAt, setStartsAt] = useState<Date | null>(
    initialEvent?.starts_at ? new Date(initialEvent.starts_at) : null
  );
  const [locationMode, setLocationMode] = useState<"physical" | "online">(
    initialEvent?.is_online ? "online" : "physical"
  );
  const [categoryLabel, setCategoryLabel] = useState<string | null>(
    initialEvent?.activity_type ? ACTIVITY_TYPE_LABELS[initialEvent.activity_type] : null
  );

  // --- Community-only: recurring schedule + join approval ---
  const [frequencyLabel, setFrequencyLabel] = useState<string | null>(
    initialEvent?.frequency ? FREQUENCY_LABELS[initialEvent.frequency] : null
  );
  const [joinPolicyLabel, setJoinPolicyLabel] = useState<string>(
    initialEvent && initialEvent.kind === "community"
      ? JOIN_POLICY_LABELS[initialEvent.join_policy]
      : JOIN_POLICY_LABELS.anyone
  );

  // --- Shared: physical location (event when not online, always for community) ---
  const [location, setLocation] = useState<LocationValue | null>(
    initialEvent?.location_lat != null && initialEvent?.location_lng != null && initialEvent?.location_label
      ? { lat: initialEvent.location_lat, lng: initialEvent.location_lng, label: initialEvent.location_label }
      : null
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
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

    // Cover image
    coverWrap: { alignItems: "center" },
    coverBanner: {
      width: "100%",
      height: 160,
      borderRadius: radius.md,
      overflow: "hidden",
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    coverAvatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      overflow: "hidden",
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    coverImage: { width: "100%", height: "100%" },
    coverBadge: {
      position: "absolute",
      bottom: spacing.sm,
      right: spacing.sm,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    changePhotoText: { color: colors.primary, fontSize: fontSize.base, fontWeight: "600", marginTop: spacing.sm },

    // Physical/Online segmented toggle
    segmentRow: { flexDirection: "row", gap: spacing.sm },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segmentText: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
    segmentTextActive: { color: colors.primaryText },

    // Photo-source sheet (mirrors CreateGroupScreen's / ProfileForm's)
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: "hidden",
      paddingVertical: spacing.sm,
    },
    sheetTitle: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    sheetOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    sheetOptionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    sheetOptionPressed: { backgroundColor: colors.chipBackground },
    sheetOptionText: { fontSize: fontSize.md, color: colors.text, textAlign: "center" },
    sheetCancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
  }));

  // Mirrors CreateGroupScreen's pickPhoto (permission -> launch -> resize)
  // but stops short of uploading — a brand-new event/community doesn't have
  // an id yet, so this just stores the resized file + a local preview uri;
  // onSubmit below uploads it once there's an id to attach it to. Aspect
  // ratio matches the "cover" framing for events vs "profile picture"
  // framing for communities.
  async function pickPhoto(source: "camera" | "library") {
    setCoverSheetOpen(false);
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera permission denied. Enable it in your device settings to take a photo."
          : "Photo library permission denied. Enable it in your device settings to choose a photo."
      );
      return;
    }

    const aspect: [number, number] = effectiveKind === "event" ? [16, 9] : [1, 1];
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled || !result.assets?.length) return;

    setCoverPicking(true);
    try {
      const size = effectiveKind === "event" ? { width: 960, height: 540 } : { width: 640, height: 640 };
      const resized = await ImageManipulator.manipulate(result.assets[0].uri).resize(size).renderAsync();
      const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      const file: Blob =
        Platform.OS === "web" ? await (await fetch(saved.uri)).blob() : (new File(saved.uri) as unknown as Blob);
      setCoverPhoto({ file, mimeType: "image/jpeg", previewUri: saved.uri });
      setCoverPreviewUrl(saved.uri);
    } catch (err) {
      console.error("Cover photo pick failed:", err);
      setError(err instanceof Error ? `Couldn't use that photo: ${err.message}` : "Couldn't use that photo. Try again.");
    } finally {
      setCoverPicking(false);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    if (effectiveKind === "event") {
      if (!startsAt) {
        setError("Pick a date and time.");
        return;
      }
      if (locationMode === "physical" && !location) {
        setError("Set a location, or switch to Online.");
        return;
      }
    } else {
      if (!frequencyLabel) {
        setError("Pick how often this repeats.");
        return;
      }
      if (!location) {
        setError("Set a location before continuing.");
        return;
      }
    }

    setSaving(true);
    try {
      const isOnlineEvent = effectiveKind === "event" && locationMode === "online";
      const payload = {
        kind: effectiveKind,
        title: title.trim(),
        description: description.trim() || null,
        starts_at: effectiveKind === "event" ? startsAt!.toISOString() : null,
        frequency: effectiveKind === "community" ? (FREQUENCY.byLabel[frequencyLabel!] as Frequency) : null,
        is_online: isOnlineEvent,
        location_lat: isOnlineEvent ? null : location!.lat,
        location_lng: isOnlineEvent ? null : location!.lng,
        location_label: isOnlineEvent ? null : location!.label,
        join_policy:
          effectiveKind === "community" ? (JOIN_POLICY.byLabel[joinPolicyLabel] as JoinPolicy) : "anyone" as JoinPolicy,
        activity_type:
          effectiveKind === "event" && categoryLabel ? (ACTIVITY_TYPE.byLabel[categoryLabel] as ActivityType) : null,
      };
      let saved = initialEvent ? await updateEvent(initialEvent.id, payload) : await createEvent(payload);

      if (coverPhoto) {
        // Best-effort — the event/community itself was already saved
        // successfully; a failed cover upload shouldn't block continuing.
        // Same fire-and-forget tradeoff as CreateGroupScreen's group photo.
        try {
          saved = await uploadEventCover(saved.id, coverPhoto);
        } catch (err) {
          console.error("Cover photo upload failed:", err);
        }
      }

      if (!initialEvent) {
        // Create mode only — clear the form for the next entry. Edit mode
        // navigates away instead (see EditEventScreen), so resetting here
        // would just flash empty fields right before that happens.
        setTitle("");
        setDescription("");
        setCoverPhoto(null);
        setCoverPreviewUrl(null);
        setStartsAt(null);
        setLocationMode("physical");
        setCategoryLabel(null);
        setFrequencyLabel(null);
        setJoinPolicyLabel(JOIN_POLICY_LABELS.anyone);
        setLocation(null);
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
      <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>
        {effectiveKind === "event" ? "Event Settings" : "Community Settings"}
      </Text>

      <View style={styles.coverWrap}>
        <Pressable
          onPress={() => setCoverSheetOpen(true)}
          disabled={coverPicking}
          style={effectiveKind === "event" ? styles.coverBanner : styles.coverAvatar}
        >
          {coverPreviewUrl ? (
            <Image source={{ uri: coverPreviewUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <Ionicons name="image-outline" size={36} color={colors.textMuted} />
          )}
          <View style={styles.coverBadge}>
            {coverPicking ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.primaryText} />
            )}
          </View>
        </Pressable>
        <Pressable onPress={() => setCoverSheetOpen(true)} disabled={coverPicking} hitSlop={8}>
          <Text style={styles.changePhotoText}>
            {coverPreviewUrl
              ? "Change photo"
              : effectiveKind === "event"
                ? "Add cover image (optional)"
                : "Add community photo (optional)"}
          </Text>
        </Pressable>
      </View>

      <TextField
        label="Title"
        placeholder={effectiveKind === "event" ? "Event name" : "Community name"}
        value={title}
        onChangeText={setTitle}
        maxLength={150}
      />

      <TextField
        label="Description"
        placeholder={effectiveKind === "event" ? "What's this event about?" : "What's this community about?"}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        style={styles.descriptionInput}
      />

      {effectiveKind === "event" ? (
        <>
          <DateTimeField label="Date & time" value={startsAt} onChange={setStartsAt} minimumDate={new Date()} />

          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segment, locationMode === "physical" && styles.segmentActive]}
              onPress={() => setLocationMode("physical")}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={locationMode === "physical" ? colors.primaryText : colors.text}
              />
              <Text style={[styles.segmentText, locationMode === "physical" && styles.segmentTextActive]}>
                Physical
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, locationMode === "online" && styles.segmentActive]}
              onPress={() => setLocationMode("online")}
            >
              <Ionicons
                name="globe-outline"
                size={16}
                color={locationMode === "online" ? colors.primaryText : colors.text}
              />
              <Text style={[styles.segmentText, locationMode === "online" && styles.segmentTextActive]}>Online</Text>
            </Pressable>
          </View>
          {locationMode === "physical" && (
            <LocationPicker initialLabel={initialEvent?.location_label} onChange={setLocation} />
          )}

          <Text style={styles.sectionTitle}>Category</Text>
          <Select
            label="🏷️ Category"
            placeholder="What's this event about?"
            value={categoryLabel}
            options={ACTIVITY_TYPE.options}
            onChange={setCategoryLabel}
          />
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Location / Area</Text>
          <LocationPicker initialLabel={initialEvent?.location_label} onChange={setLocation} />

          <Select
            label="Recurring schedule"
            placeholder="How often does this meet?"
            value={frequencyLabel}
            options={FREQUENCY.options}
            onChange={setFrequencyLabel}
          />

          <Select
            label="Who can join"
            value={joinPolicyLabel}
            options={JOIN_POLICY.options}
            onChange={setJoinPolicyLabel}
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label={submitLabel} onPress={onSubmit} loading={saving} />

      <Modal visible={coverSheetOpen} transparent animationType="fade" onRequestClose={() => setCoverSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCoverSheetOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{effectiveKind === "event" ? "Cover image" : "Community photo"}</Text>
            <Pressable
              onPress={() => pickPhoto("camera")}
              style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => pickPhoto("library")}
              style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </Pressable>
            <Pressable
              onPress={() => setCoverSheetOpen(false)}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
