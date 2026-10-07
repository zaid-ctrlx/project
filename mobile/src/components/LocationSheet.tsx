import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/client";
import { reverseGeocode } from "../api/geocode";
import { updateProfile } from "../api/profile";
import { INDIA_BOUNDARY } from "../constants/mapRegion";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import LocationMapPicker from "./LocationMapPicker";
import LocationPicker, { LocationValue } from "./LocationPicker";

// Feed radius choices (km); null = no distance limit.
export const RADIUS_OPTIONS: (number | null)[] = [null, 10, 25, 50, 100];

type Props = {
  visible: boolean;
  onClose: () => void;
  radiusKm: number | null;
  onRadiusChange: (km: number | null) => void;
};

type View_ = "menu" | "search" | "map";

function withinIndia(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BOUNDARY.southWest.latitude &&
    lat <= INDIA_BOUNDARY.northEast.latitude &&
    lng >= INDIA_BOUNDARY.southWest.longitude &&
    lng <= INDIA_BOUNDARY.northEast.longitude
  );
}

// "Change location" sheet opened from Home's location pill. Three ways to
// set it — search/type a place, use the device's GPS, or tap a point on an
// India map (Marketplace-style) — plus the feed's search radius. Saving
// updates the profile's location (the same fields onboarding sets), which
// is what Home filters by.
export default function LocationSheet({ visible, onClose, radiusKm, onRadiusChange }: Props) {
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>("menu");
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<LocationValue | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number; label: string | null } | null>(null);
  const pickSeq = useRef(0);

  const { styles, colors } = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      maxHeight: "92%",
    },
    sheetTall: { height: "88%" },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
    current: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    currentText: { flex: 1, color: colors.textMuted, fontSize: fontSize.base },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing.sm,
    },
    optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    optionText: { flex: 1 },
    optionTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    optionSub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.textFaint, marginTop: spacing.md, marginBottom: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
    chipTextActive: { color: colors.primaryText },
    error: { color: colors.danger, fontSize: fontSize.base, marginTop: spacing.sm },
    hint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm },
    mapWrap: { flex: 1, marginBottom: spacing.md },
    pickedBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    pickedText: { flex: 1, color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    pickedHint: { flex: 1, color: colors.textMuted, fontSize: fontSize.base },
  }));

  // Fresh state each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setView("menu");
      setError(null);
      setPending(null);
      setPicked(null);
      setSaving(false);
      setGpsBusy(false);
    }
  }, [visible]);

  const apply = useCallback(
    async (value: LocationValue) => {
      if (!user) return;
      if (!withinIndia(value.lat, value.lng)) {
        setError("That spot is outside India. Please choose a location within India.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const updated = await updateProfile({
          full_name: user.full_name,
          username: user.username,
          bio: user.bio,
          gender: user.gender,
          location_lat: value.lat,
          location_lng: value.lng,
          location_label: value.label,
          tag_ids: user.tags.map((t) => t.id),
        });
        setUser(updated);
        onClose();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't update your location. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [user, setUser, onClose]
  );

  async function useCurrentLocation() {
    setError(null);
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. You can search for a place or pick one on the map instead.");
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({});
      let label = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try {
        label = (await reverseGeocode(coords.latitude, coords.longitude)).label;
      } catch {
        // Keep the raw-coordinate label rather than blocking the change.
      }
      await apply({ label, lat: coords.latitude, lng: coords.longitude });
    } catch {
      setError("Couldn't get your location. Try searching or picking on the map.");
    } finally {
      setGpsBusy(false);
    }
  }

  const onMapPick = useCallback((lat: number, lng: number) => {
    const seq = ++pickSeq.current;
    setError(null);
    setPicked({ lat, lng, label: null });
    reverseGeocode(lat, lng)
      .then(({ label }) => {
        if (seq === pickSeq.current) setPicked({ lat, lng, label });
      })
      .catch(() => {
        if (seq === pickSeq.current) setPicked({ lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      });
  }, []);

  const titles: Record<View_, string> = { menu: "Change location", search: "Search for a place", map: "Pick on the map" };
  const busy = saving || gpsBusy;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, view === "map" && styles.sheetTall, { paddingBottom: spacing.lg + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {view !== "menu" && (
                <Pressable onPress={() => { setView("menu"); setError(null); }} hitSlop={8} style={styles.iconButton}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              )}
              <Text style={styles.title}>{titles[view]}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.iconButton}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {view === "menu" && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {user?.location_label ? (
                <View style={styles.current}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.currentText} numberOfLines={2}>
                    Currently: {user.location_label}
                  </Text>
                </View>
              ) : null}

              <Pressable style={styles.option} onPress={useCurrentLocation} disabled={busy}>
                <View style={styles.optionIcon}>
                  {gpsBusy || saving ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="locate" size={20} color={colors.primary} />
                  )}
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Use my current location</Text>
                  <Text style={styles.optionSub}>Auto-detect with GPS</Text>
                </View>
              </Pressable>

              <Pressable style={styles.option} onPress={() => { setError(null); setView("search"); }} disabled={busy}>
                <View style={styles.optionIcon}>
                  <Ionicons name="search" size={20} color={colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Search for a place</Text>
                  <Text style={styles.optionSub}>Type a city, area or address</Text>
                </View>
              </Pressable>

              <Pressable style={styles.option} onPress={() => { setError(null); setView("map"); }} disabled={busy}>
                <View style={styles.optionIcon}>
                  <Ionicons name="map" size={20} color={colors.primary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Pick on the map</Text>
                  <Text style={styles.optionSub}>Tap any spot in India</Text>
                </View>
              </Pressable>

              <Text style={styles.sectionLabel}>Show activities within</Text>
              <View style={styles.chipRow}>
                {RADIUS_OPTIONS.map((km) => (
                  <Pressable
                    key={km ?? "any"}
                    onPress={() => onRadiusChange(km)}
                    style={[styles.chip, radiusKm === km && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, radiusKm === km && styles.chipTextActive]}>
                      {km === null ? "Anywhere" : `${km} km`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
          )}

          {view === "search" && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>Search and pick a result, then confirm.</Text>
              <LocationPicker initialLabel={null} onChange={setPending} />
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  label="Set as my location"
                  onPress={() => pending && apply(pending)}
                  loading={saving}
                  disabled={!pending}
                />
              </View>
            </ScrollView>
          )}

          {view === "map" && (
            <>
              <View style={styles.mapWrap}>
                <LocationMapPicker
                  initial={user?.location_lat != null && user?.location_lng != null ? { lat: user.location_lat, lng: user.location_lng } : null}
                  onPick={onMapPick}
                />
              </View>
              <View style={styles.pickedBar}>
                <Ionicons name="location" size={18} color={picked ? colors.primary : colors.textFaint} />
                {picked ? (
                  picked.label ? (
                    <Text style={styles.pickedText} numberOfLines={2}>{picked.label}</Text>
                  ) : (
                    <Text style={styles.pickedHint}>Finding place name…</Text>
                  )
                ) : (
                  <Text style={styles.pickedHint}>Tap the map to drop a pin.</Text>
                )}
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label="Use this location"
                onPress={() => picked && apply({ lat: picked.lat, lng: picked.lng, label: picked.label ?? `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}` })}
                loading={saving}
                disabled={!picked}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
