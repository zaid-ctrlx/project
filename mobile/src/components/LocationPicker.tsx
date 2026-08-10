import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { GeocodeResult, reverseGeocode, searchLocation as searchLocationApi } from "../api/geocode";
import { colors, fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import TextField from "./TextField";

export type LocationValue = { label: string; lat: number; lng: number };

type Props = {
  // Only the label is needed here, to pre-fill the search box — the parent
  // owns the actual seeded {label,lat,lng} value (see ProfileForm's
  // `location` state) since this component only reports changes, it
  // doesn't need the coordinates for anything of its own.
  initialLabel?: string | null;
  onChange: (value: LocationValue) => void;
};

// Extracted from ProfileForm's original location section (search-with-
// debounced-dropdown + "use my current location" GPS button) so it can be
// reused as-is by Create Event. Owns its own search/debounce/dropdown state
// since that's transient UI state, not something the parent form needs —
// it only hears about a confirmed selection via onChange.
export default function LocationPicker({ initialLabel, onChange }: Props) {
  const [locationLabel, setLocationLabel] = useState<string | null>(initialLabel ?? null);
  const [searchText, setSearchText] = useState(initialLabel ?? "");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commit(label: string, lat: number, lng: number) {
    setLocationLabel(label);
    setSearchText(label);
    onChange({ label, lat, lng });
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
      const fallbackLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      commit(fallbackLabel, latitude, longitude);

      try {
        const { label } = await reverseGeocode(latitude, longitude);
        commit(label, latitude, longitude);
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
    commit(result.label, result.lat, result.lng);
    setSearchResults([]);
    setLocationError(null);
  }

  return (
    <View>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
});
