import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError } from "../api/client";
import { GeocodeResult, reverseGeocode, searchLocation as searchLocationApi } from "../api/geocode";
import { fetchTags, updateProfile } from "../api/profile";
import { Tag } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function OnboardingScreen() {
  const { setUser } = useAuth();

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [tagsLoading, setTagsLoading] = useState(true);

  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchText, setSearchText] = useState("");
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
        // Non-fatal: user can still save profile with location only, and
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
      // Set coords immediately so "Continue" is already valid even if the
      // reverse-geocode call below is slow or fails.
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

  // Live autocomplete: search as the user types, debounced so we're not
  // firing a request per keystroke. Skipped once searchText matches the
  // already-selected label, so picking a result (which fills the input)
  // doesn't immediately re-trigger a search against itself.
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
    if (!locationCoords || !locationLabel) {
      setSaveError("Set a location before continuing.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        location_lat: locationCoords.lat,
        location_lng: locationCoords.lng,
        location_label: locationLabel,
        tag_ids: Array.from(selectedTagIds),
      });
      setUser(updated);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>This helps us recommend relevant events near you.</Text>

      <Text style={styles.sectionTitle}>Interests</Text>
      {tagsLoading ? (
        <ActivityIndicator />
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
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Location</Text>

      <Pressable style={styles.secondaryButton} onPress={useCurrentLocation} disabled={gpsBusy}>
        <Text style={styles.secondaryButtonText}>
          {gpsBusy ? "Locating..." : "📍 Use my current location"}
        </Text>
      </Pressable>

      <Text style={styles.orText}>or search for it</Text>

      <View>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, styles.searchInput]}
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
                style={[styles.dropdownItem, i < searchResults.length - 1 && styles.dropdownItemBorder]}
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

      <Pressable style={styles.button} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tagChipSelected: { backgroundColor: "#111", borderColor: "#111" },
  tagChipText: { fontSize: 14, color: "#333" },
  tagChipTextSelected: { color: "#fff" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#111",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111", fontWeight: "600" },
  orText: { textAlign: "center", color: "#999", marginVertical: 12, fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  searchInput: { flex: 1 },
  searchSpinner: { width: 24 },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  dropdownItem: { padding: 12 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: "#eee" },
  dropdownItemText: { fontSize: 14, color: "#333" },
  error: { color: "#c00", marginTop: 12 },
  locationConfirm: { color: "#0a0", marginTop: 12, fontSize: 14 },
  button: { backgroundColor: "#111", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 28 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
