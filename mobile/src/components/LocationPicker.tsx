import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { GeocodeResult, reverseGeocode, searchLocation as searchLocationApi } from "../api/geocode";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

export type LocationValue = { label: string; lat: number; lng: number };

type Props = {
  // Only the label is needed here, to pre-fill the search box — the parent
  // owns the actual seeded {label,lat,lng} value (see ProfileForm's
  // `location` state) since this component only reports changes, it
  // doesn't need the coordinates for anything of its own.
  initialLabel?: string | null;
  onChange: (value: LocationValue) => void;
};

// One bar, not a button-then-field stack: a plain text input taking up most
// of the width (type to search, live autocomplete below) with a smaller
// location-pin segment on the right, visually part of the same
// bordered/rounded box, that fills the bar in with the device's current
// location via GPS + reverse geocoding. Replaces the earlier
// "📍 Use my current location" button + "or search for it" + separate field
// stack — same underlying search/GPS logic (see useCurrentLocation and the
// debounced-search effect below), just one control instead of three.
export default function LocationPicker({ initialLabel, onChange }: Props) {
  const [locationLabel, setLocationLabel] = useState<string | null>(initialLabel ?? null);
  const [searchText, setSearchText] = useState(initialLabel ?? "");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { styles, colors } = useThemedStyles((colors) => ({
    bar: {
      flexDirection: "row",
      alignItems: "stretch",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    inputWrap: { flex: 1, justifyContent: "center" },
    input: {
      paddingVertical: spacing.md,
      paddingLeft: spacing.lg,
      paddingRight: spacing.xl + spacing.md,
      fontSize: fontSize.md,
      color: colors.text,
    },
    searchSpinner: { position: "absolute", right: spacing.md },
    divider: { width: 1, backgroundColor: colors.border },
    gpsButton: {
      width: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.chipBackground,
    },
    gpsButtonPressed: { opacity: 0.7 },
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
    error: { color: colors.danger, fontSize: fontSize.base, marginTop: spacing.xs },
    locationConfirm: { color: colors.success, fontSize: fontSize.base, marginTop: spacing.xs },
  }));

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
      <View style={styles.bar}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Search for a location"
            placeholderTextColor={colors.textFaint}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchBusy && <ActivityIndicator style={styles.searchSpinner} size="small" color={colors.textFaint} />}
        </View>
        <View style={styles.divider} />
        <Pressable
          onPress={useCurrentLocation}
          disabled={gpsBusy}
          hitSlop={4}
          style={({ pressed }) => [styles.gpsButton, pressed && styles.gpsButtonPressed]}
        >
          {gpsBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate" size={20} color={colors.primary} />
          )}
        </Pressable>
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

      {locationError && <Text style={styles.error}>{locationError}</Text>}
      {locationLabel && searchResults.length === 0 && (
        <Text style={styles.locationConfirm}>✓ Location set: {locationLabel}</Text>
      )}
    </View>
  );
}
