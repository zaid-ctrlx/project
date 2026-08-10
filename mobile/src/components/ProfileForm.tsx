import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Gender, GENDER_OPTIONS, User } from "../api/auth";
import { ApiError, mediaUrl } from "../api/client";
import { updateProfile, uploadAvatar } from "../api/profile";
import { colors, fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import LocationPicker, { LocationValue } from "./LocationPicker";
import Select from "./Select";
import TagMultiSelect from "./TagMultiSelect";
import TextField from "./TextField";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

type Props = {
  initialFullName?: string | null;
  initialUsername?: string | null;
  initialBio?: string | null;
  initialGender?: Gender | null;
  initialAvatarUrl?: string | null;
  initialTagIds?: string[];
  initialLocationLabel?: string | null;
  initialLocationCoords?: { lat: number; lng: number } | null;
  submitLabel: string;
  onSaved: (user: User) => void;
  // Avatar upload persists (and is reflected server-side) the moment it's
  // picked, independent of the Save button — this lets the caller update
  // its own copy of `user` right away without closing the edit form the
  // way onSaved does.
  onAvatarUpdated?: (user: User) => void;
};

// Shared by onboarding (first-time setup) and the profile screen (editing
// later) — same fields, same validation, just different initial values and
// submit-button copy.
export default function ProfileForm({
  initialFullName,
  initialUsername,
  initialBio,
  initialGender,
  initialAvatarUrl,
  initialTagIds,
  initialLocationLabel,
  initialLocationCoords,
  submitLabel,
  onSaved,
  onAvatarUpdated,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [gender, setGender] = useState<Gender | null>(initialGender ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(initialTagIds ?? []));

  const [location, setLocation] = useState<LocationValue | null>(
    initialLocationCoords && initialLocationLabel
      ? { label: initialLocationLabel, lat: initialLocationCoords.lat, lng: initialLocationCoords.lng }
      : null
  );

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickAndUploadAvatar(source: "camera" | "library") {
    setSaveError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setSaveError(
        source === "camera"
          ? "Camera permission denied. Enable it in your device settings to take a photo."
          : "Photo library permission denied. Enable it in your device settings to choose a photo."
      );
      return;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      // Phone cameras can produce multi-megabyte originals even after the
      // picker's own `quality` compression — downscale to a sensible avatar
      // size first so the upload is small and fast regardless of source
      // resolution (also keeps it comfortably under the backend's 5MB cap).
      const resized = await ImageManipulator.manipulate(asset.uri)
        .resize({ width: 640, height: 640 })
        .renderAsync();
      const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

      // Need a real Blob-like part for FormData (see PickedAvatar for why).
      // Web: saved.uri is a blob: URL — re-fetching it gives a real Blob.
      // Native: expo-file-system's File wraps the local file:// uri and
      // implements the Blob interface (.bytes()) without expo-file-system
      // being web-supported, hence the platform split.
      const file: Blob =
        Platform.OS === "web"
          ? await (await fetch(saved.uri)).blob()
          : (new File(saved.uri) as unknown as Blob);

      const updated = await uploadAvatar({ file, mimeType: "image/jpeg" });
      setAvatarUrl(updated.avatar_url);
      onAvatarUpdated?.(updated);
    } catch (err) {
      // Surface the real reason instead of a blanket message — a bare
      // fetch failure (e.g. the picked file couldn't be read/attached)
      // throws a plain Error before the backend ever sees the request, so
      // ApiError won't catch it and swallowing it here hides the cause.
      console.error("Avatar upload failed:", err);
      setSaveError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? `Couldn't upload photo: ${err.message}`
            : "Couldn't upload photo. Try again."
      );
    } finally {
      setAvatarUploading(false);
    }
  }

  function chooseAvatarSource() {
    setAvatarSheetOpen(true);
  }

  function pickFromSheet(source: "camera" | "library") {
    setAvatarSheetOpen(false);
    pickAndUploadAvatar(source);
  }

  async function onSave() {
    setSaveError(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || !USERNAME_PATTERN.test(trimmedUsername)) {
      setSaveError("Username must be at least 3 characters: letters, numbers, and underscores only.");
      return;
    }
    if (!location) {
      setSaveError("Set a location before continuing.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim() || null,
        username: trimmedUsername,
        bio: bio.trim() || null,
        gender,
        location_lat: location.lat,
        location_lng: location.lng,
        location_label: location.label,
        tag_ids: Array.from(selectedTagIds),
      });
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarSection}>
        <Pressable onPress={chooseAvatarSource} disabled={avatarUploading} style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: mediaUrl(avatarUrl)! }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{(username || "?").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {avatarUploading ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.primaryText} />
            )}
          </View>
        </Pressable>
        <Pressable onPress={chooseAvatarSource} disabled={avatarUploading} hitSlop={8}>
          <Text style={styles.changePhotoText}>{avatarUploading ? "Uploading..." : "Change photo"}</Text>
        </Pressable>
      </View>

      {/* Custom sheet instead of Alert.alert — RN Web's Alert doesn't
          support multiple interactive buttons, so a 3-option chooser
          silently does nothing there. This renders identically on both. */}
      <Modal
        visible={avatarSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarSheetOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAvatarSheetOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Change profile photo</Text>
            <Pressable
              onPress={() => pickFromSheet("camera")}
              style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => pickFromSheet("library")}
              style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </Pressable>
            <Pressable
              onPress={() => setAvatarSheetOpen(false)}
              style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <TextField label="Name" placeholder="Your name" value={fullName} onChangeText={setFullName} />

      <TextField
        label="Username"
        placeholder="e.g. zaid_123"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.helperText}>Unique — this is how people find and search for you.</Text>

      <TextField
        label="Bio"
        placeholder="Tell people a bit about yourself"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={150}
        style={styles.bioInput}
      />

      <Select label="Gender" placeholder="Select gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} />

      <Text style={styles.sectionTitle}>Interests</Text>
      <TagMultiSelect selectedIds={selectedTagIds} onChange={setSelectedTagIds} />

      <Text style={styles.sectionTitle}>Location</Text>
      <LocationPicker initialLabel={initialLocationLabel} onChange={setLocation} />

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <View style={styles.submitRow}>
        <Button label={submitLabel} onPress={onSave} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background, gap: spacing.md },
  avatarSection: { alignItems: "center", marginBottom: spacing.sm },
  avatarWrap: { width: 96, height: 96 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: { fontSize: 36, fontWeight: "700", color: colors.text },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  changePhotoText: { color: colors.primary, fontSize: fontSize.base, fontWeight: "600", marginTop: spacing.sm },
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
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  helperText: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: -spacing.xs },
  bioInput: { minHeight: 60, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: fontSize.base },
  submitRow: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
