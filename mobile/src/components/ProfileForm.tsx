import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Gender, GENDER_OPTIONS, Tag, User } from "../api/auth";
import { ApiError } from "../api/client";
import { GeocodeResult, reverseGeocode, searchLocation as searchLocationApi } from "../api/geocode";
import { fetchTags, updateProfile } from "../api/profile";
import { colors, fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import TextField from "./TextField";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

type Props = {
  initialFullName?: string | null;
  initialUsername?: string | null;
  initialBio?: string | null;
  initialGender?: Gender | null;
  initialTagIds?: string[];
  initialLocationLabel?: string | null;
  initialLocationCoords?: { lat: number; lng: number } | null;
  submitLabel: string;
  onSaved: (user: User) => void;
};

// Shared by onboarding (first-time setup) and the profile screen (editing
// later) — same fields, same validation, just different initial values and
// submit-button copy.
export default function ProfileForm({
  initialFullName,
  initialUsername,
  initialBio,
  initialGender,
  initialTagIds,
  initialLocationLabel,
  initialLocationCoords,
  submitLabel,
  onSaved,
}: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [gender, setGender] = useState<Gender | null>(initialGender ?? null);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(initialTagIds ?? []));
  const [tagsLoading, setTagsLoading] = useState(true);

  const [locationLabel, setLocationLabel] = useState<string | null>(initialLocationLabel ?? null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(
    initialLocationCoords ?? null
  );
  const [searchText, setSearchText] = useState(initialLocationLabel ?? "");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setTags(await fetchTags());
      } catch {
        // Non-fatal: user can still save with location/name only, and
        // retry tags by reopening the screen.
      } finally {
        setTagsLoading(false);
      }
    })();
  }, []);

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function useCurrentLocation() {
    setLocationError(null);
    setGpsBusy(true);
    setSearchResults([]);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied. You can search for your location instead.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      setLocationCoords({ lat: latitude, lng: longitude });
      const fallbackLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setLocationLabel(fallbackLabel);
      setSearchText(fallbackLabel);

      try {
        const { label } = await reverseGeocode(latitude, longitude);
        setLocationLabel(label);
        setSearchText(label);
      } catch {
        // Backend/network hiccup — keep the raw-coordinate label already set
        // above rather than blocking the user from continuing.
      }
    } catch {
      setLocationError("Couldn't get your location. Try searching for it instead.");
    } finally {
      setGpsBusy(false);
    }
  }

  // Live autocomplete: search as the user types, debounced. Skipped once
  // searchText matches the already-selected label, so picking a result
  // (which fills the input) doesn't immediately re-trigger a search.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (searchText.trim().length < 3 || searchText === locationLabel) {
      setSearchResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchBusy(true);
      setLocationError(null);
      try {
        const results = await searchLocationApi(searchText.trim());
        setSearchResults(results);
        if (results.length === 0) {
          setLocationError("No matches found. Try a different search.");
        }
      } catch {
        setLocationError("Search failed. Check your connection and try again.");
      } finally {
        setSearchBusy(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchText]);

  function selectSearchResult(result: GeocodeResult) {
    setLocationCoords({ lat: result.lat, lng: result.lng });
    setLocationLabel(result.label);
    setSearchText(result.label);
    setSearchResults([]);
    setLocationError(null);
  }

  async function onSave() {
    setSaveError(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || !USERNAME_PATTERN.test(trimmedUsername)) {
      setSaveError("Username must be at least 3 characters: letters, numbers, and underscores only.");
      return;
    }
    if (!locationCoords || !locationLabel) {
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
        location_lat: locationCoords.lat,
        location_lng: locationCoords.lng,
        location_label: locationLabel,
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

      <Text style={styles.sectionTitle}>Gender</Text>
      <View style={styles.tagRow}>
        {GENDER_OPTIONS.map((option) => {
          const selected = gender === option;
          return (
            <Pressable
              key={option}
              onPress={() => setGender(selected ? null : option)}
              style={[styles.tagChip, selected && styles.tagChipSelected]}
            >
              <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Interests</Text>
      {tagsLoading ? (
        <ActivityIndicator style={styles.tagsLoading} />
      ) : (
        <View style={styles.tagRow}>
          {tags.map((tag) => {
            const selected = selectedTagIds.has(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => toggleTag(tag.id)}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
              >
                <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                  {tag.name}
                  {selected ? "  ✕" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Location</Text>

      <Button
        label={gpsBusy ? "Locating..." : "📍 Use my current location"}
        onPress={useCurrentLocation}
        loading={gpsBusy}
        variant="secondary"
      />

      <Text style={styles.orText}>or search for it</Text>

      <View>
        <View style={styles.searchRow}>
          <TextField
            containerStyle={styles.searchInputContainer}
            placeholder="e.g. Gulshan, Karachi"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchBusy && <ActivityIndicator style={styles.searchSpinner} />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map((result, i) => (
              <Pressable
                key={`${result.lat},${result.lng}`}
                onPress={() => selectSearchResult(result)}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  i < searchResults.length - 1 && styles.dropdownItemBorder,
                  pressed && styles.dropdownItemPressed,
                ]}
              >
                <Text style={styles.dropdownItemText}>{result.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {locationError && <Text style={styles.error}>{locationError}</Text>}
      {locationLabel && searchResults.length === 0 && (
        <Text style={styles.locationConfirm}>✓ Location set: {locationLabel}</Text>
      )}

      {saveError && <Text style={styles.error}>{saveError}</Text>}

      <View style={styles.submitRow}>
        <Button label={submitLabel} onPress={onSave} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, backgroundColor: colors.background, gap: spacing.md },
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
  tagsLoading: { alignSelf: "flex-start" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.chipBackground,
  },
  tagChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChipText: { fontSize: fontSize.base, color: colors.text },
  tagChipTextSelected: { color: colors.primaryText },
  orText: { textAlign: "center", color: colors.textFaint, fontSize: fontSize.sm },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInputContainer: { flex: 1 },
  searchSpinner: { position: "absolute", right: spacing.md },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  dropdownItem: { padding: spacing.md },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropdownItemPressed: { backgroundColor: colors.chipBackground },
  dropdownItemText: { fontSize: fontSize.base, color: colors.text },
  error: { color: colors.danger, fontSize: fontSize.base },
  locationConfirm: { color: colors.success, fontSize: fontSize.base },
  submitRow: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
