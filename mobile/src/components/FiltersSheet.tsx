import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { reverseGeocode } from "../api/geocode";
import { INDIA_BOUNDARY } from "../constants/mapRegion";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  FeedFilters,
  FilterLocation,
  formatDay,
  RADIUS_CHOICES,
  radiusLabel,
  SORT_LABELS,
  SortKey,
  toDayString,
} from "../lib/feedFilters";
import { fontSize, radius, spacing } from "../theme";
import Button from "./Button";
import DateField from "./DateField";
import LocationMapPicker from "./LocationMapPicker";
import LocationPicker, { LocationValue } from "./LocationPicker";

type Props = {
  visible: boolean;
  onClose: () => void;
  filters: FeedFilters;
  onApply: (filters: FeedFilters) => void;
};

type SheetView = "main" | "search" | "map";
type SectionKey = "location" | "radius" | "sort" | "date";

function withinIndia(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BOUNDARY.southWest.latitude &&
    lat <= INDIA_BOUNDARY.northEast.latitude &&
    lng >= INDIA_BOUNDARY.southWest.longitude &&
    lng <= INDIA_BOUNDARY.northEast.longitude
  );
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Home's Filters sheet. Four independent filters that all apply together:
//  - Location: where to look from (GPS, search, or a pin on the India map);
//    feed-only, the profile location is untouched
//  - Within: radius around that location
//  - Sort: soonest / nearest / recently added
//  - Dates: an inclusive from–to range (applies to events; communities have
//    no date so they stay visible)
// Edits are drafted and only take effect on "Apply filters".
export default function FiltersSheet({ visible, onClose, filters, onApply }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FeedFilters>(filters);
  const [view, setView] = useState<SheetView>("main");
  // Accordion: one filter's options visible at a time; all collapsed by default.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
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
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
      maxHeight: "90%",
    },
    sheetTall: { height: "90%" },
    grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
    title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
    scroll: { paddingBottom: spacing.md },
    accCard: { borderRadius: radius.md, backgroundColor: colors.surfaceElevated, marginBottom: spacing.sm, overflow: "hidden" },
    accHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    accIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
    accText: { flex: 1 },
    accTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    accSummary: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
    accSummaryActive: { color: colors.primary, fontWeight: "600" },
    accBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    section: { marginBottom: spacing.xl },
    sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    sectionTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
    sectionNote: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
    locationCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      marginBottom: spacing.sm,
    },
    locationText: { flex: 1, color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    locationSub: { color: colors.textFaint, fontSize: fontSize.sm, fontWeight: "500" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: fontSize.base, fontWeight: "600", color: colors.textMuted },
    chipTextActive: { color: colors.primaryText },
    dateRow: { flexDirection: "row", gap: spacing.sm },
    footer: { flexDirection: "row", gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    footerItem: { flex: 1 },
    error: { color: colors.danger, fontSize: fontSize.base, marginTop: spacing.sm },
    hint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm },
    mapWrap: { flex: 1, marginBottom: spacing.md },
    pickedBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
    pickedText: { flex: 1, color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    pickedHint: { flex: 1, color: colors.textMuted, fontSize: fontSize.base },
  }));

  // Fresh draft each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setView("main");
      setOpenSection(null);
      setError(null);
      setPending(null);
      setPicked(null);
      setGpsBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setLocation = useCallback((loc: FilterLocation | null) => {
    setDraft((d) => ({ ...d, location: loc }));
  }, []);

  function acceptLocation(loc: FilterLocation): boolean {
    if (!withinIndia(loc.lat, loc.lng)) {
      setError("That spot is outside India. Please choose a location within India.");
      return false;
    }
    setError(null);
    setLocation(loc);
    setView("main");
    return true;
  }

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
        // keep the raw-coordinate label
      }
      acceptLocation({ label, lat: coords.latitude, lng: coords.longitude });
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

  // Date presets just fill the from/to fields.
  const today = new Date();
  const todayStr = toDayString(today);
  const dow = today.getDay(); // 0 Sun .. 6 Sat
  const satOffset = dow === 0 ? -1 : 6 - dow; // Sunday: this weekend started yesterday
  const weekendFrom = dow === 0 ? todayStr : toDayString(addDays(today, satOffset));
  const weekendTo = dow === 0 ? todayStr : toDayString(addDays(today, satOffset + 1));
  const presets: { label: string; from: string; to: string }[] = [
    { label: "Today", from: todayStr, to: todayStr },
    { label: "This weekend", from: weekendFrom, to: weekendTo },
    { label: "Next 7 days", from: todayStr, to: toDayString(addDays(today, 6)) },
  ];

  function setFrom(day: string | null) {
    setDraft((d) => ({ ...d, from: day, to: day && d.to && d.to < day ? day : d.to }));
  }

  const draftCount = activeFilterCount(draft);
  const shortPlace = (label: string) => label.split(",")[0];
  const profileLabel = user?.location_label ?? null;
  const originLabel = draft.location?.label ?? profileLabel;
  const titles: Record<SheetView, string> = { main: "Filters", search: "Search for a place", map: "Pick on the map" };
  const sorts = Object.keys(SORT_LABELS) as SortKey[];

  const locationSummary = draft.location
    ? shortPlace(draft.location.label)
    : originLabel
      ? `${shortPlace(originLabel)} · my location`
      : "Not set";
  const dateSummary =
    draft.from && draft.to
      ? draft.from === draft.to
        ? formatDay(draft.from)
        : `${formatDay(draft.from)} – ${formatDay(draft.to)}`
      : draft.from
        ? `From ${formatDay(draft.from)}`
        : draft.to
          ? `Until ${formatDay(draft.to)}`
          : "Any date";

  // Collapsible filter row: icon + title + current value, options only when
  // expanded. (A plain function returning JSX, not a component, so toggling
  // never remounts the content inside.)
  function renderSection(
    key: SectionKey,
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    summary: string,
    modified: boolean,
    body: React.ReactNode
  ) {
    const isOpen = openSection === key;
    return (
      <View style={styles.accCard}>
        <Pressable
          onPress={() => setOpenSection(isOpen ? null : key)}
          style={styles.accHeader}
          accessibilityRole="button"
          accessibilityLabel={`${title}: ${summary}`}
          accessibilityState={{ expanded: isOpen }}
        >
          <View style={styles.accIcon}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.accText}>
            <Text style={styles.accTitle}>{title}</Text>
            <Text style={[styles.accSummary, modified && styles.accSummaryActive]} numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
        </Pressable>
        {isOpen && <View style={styles.accBody}>{body}</View>}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, view === "map" && styles.sheetTall, { paddingBottom: spacing.md + insets.bottom }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {view !== "main" && (
                <Pressable onPress={() => { setView("main"); setError(null); }} hitSlop={8} style={styles.iconButton}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
              )}
              <Text style={styles.title}>{titles[view]}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.iconButton}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {view === "main" && (
            <>
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {renderSection(
                  "location",
                  "location",
                  "Location",
                  locationSummary,
                  !!draft.location,
                  <>
                    <View style={styles.locationCard}>
                      <Text style={styles.locationText} numberOfLines={2}>
                        {originLabel ?? "No location set"}
                        {!draft.location && profileLabel ? <Text style={styles.locationSub}>{"  ·  my location"}</Text> : null}
                      </Text>
                    </View>
                    <View style={styles.chipRow}>
                      <Pressable style={styles.chip} onPress={useCurrentLocation} disabled={gpsBusy}>
                        {gpsBusy ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name="locate" size={16} color={colors.primary} />
                        )}
                        <Text style={styles.chipText}>Current</Text>
                      </Pressable>
                      <Pressable style={styles.chip} onPress={() => { setError(null); setPending(null); setView("search"); }}>
                        <Ionicons name="search" size={16} color={colors.primary} />
                        <Text style={styles.chipText}>Search</Text>
                      </Pressable>
                      <Pressable style={styles.chip} onPress={() => { setError(null); setPicked(null); setView("map"); }}>
                        <Ionicons name="map" size={16} color={colors.primary} />
                        <Text style={styles.chipText}>Map</Text>
                      </Pressable>
                      {draft.location && (
                        <Pressable style={styles.chip} onPress={() => setLocation(null)}>
                          <Ionicons name="refresh" size={16} color={colors.textMuted} />
                          <Text style={styles.chipText}>My location</Text>
                        </Pressable>
                      )}
                    </View>
                    {error && <Text style={styles.error}>{error}</Text>}
                  </>
                )}

                {renderSection(
                  "radius",
                  "radio-button-on",
                  "Show activities within",
                  radiusLabel(draft.radiusKm),
                  draft.radiusKm !== null,
                  <>
                    <View style={styles.chipRow}>
                      {RADIUS_CHOICES.map((km) => (
                        <Pressable
                          key={km ?? "any"}
                          onPress={() => setDraft((d) => ({ ...d, radiusKm: km }))}
                          style={[styles.chip, draft.radiusKm === km && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, draft.radiusKm === km && styles.chipTextActive]}>{radiusLabel(km)}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {draft.radiusKm !== null && !originLabel && (
                      <Text style={styles.sectionNote}>Set a location so the distance can be measured.</Text>
                    )}
                  </>
                )}

                {renderSection(
                  "sort",
                  "swap-vertical",
                  "Sort by",
                  SORT_LABELS[draft.sort],
                  draft.sort !== "soonest",
                  <View style={styles.chipRow}>
                    {sorts.map((key) => (
                      <Pressable
                        key={key}
                        onPress={() => setDraft((d) => ({ ...d, sort: key }))}
                        style={[styles.chip, draft.sort === key && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, draft.sort === key && styles.chipTextActive]}>{SORT_LABELS[key]}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {renderSection(
                  "date",
                  "calendar-outline",
                  "Date range",
                  dateSummary,
                  !!(draft.from || draft.to),
                  <>
                    <View style={styles.dateRow}>
                      <DateField label="From" value={draft.from} onChange={setFrom} />
                      <DateField label="To" value={draft.to} onChange={(day) => setDraft((d) => ({ ...d, to: day }))} minDay={draft.from} />
                    </View>
                    <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                      {presets.map((p) => {
                        const active = draft.from === p.from && draft.to === p.to;
                        return (
                          <Pressable
                            key={p.label}
                            onPress={() => setDraft((d) => ({ ...d, from: p.from, to: p.to }))}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.sectionNote}>Applies to events. Communities have no date, so they stay in the list.</Text>
                  </>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <View style={styles.footerItem}>
                  <Button label="Clear all" variant="secondary" onPress={() => setDraft(DEFAULT_FILTERS)} disabled={draftCount === 0} />
                </View>
                <View style={styles.footerItem}>
                  <Button
                    label={draftCount > 0 ? `Apply (${draftCount})` : "Apply"}
                    onPress={() => {
                      onApply(draft);
                      onClose();
                    }}
                  />
                </View>
              </View>
            </>
          )}

          {view === "search" && (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.hint}>Search and pick a result, then confirm.</Text>
              <LocationPicker initialLabel={null} onChange={setPending} />
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={{ marginTop: spacing.lg }}>
                <Button label="Use this place" onPress={() => pending && acceptLocation(pending)} disabled={!pending} />
              </View>
            </ScrollView>
          )}

          {view === "map" && (
            <>
              <View style={styles.mapWrap}>
                <LocationMapPicker
                  initial={
                    draft.location
                      ? { lat: draft.location.lat, lng: draft.location.lng }
                      : user?.location_lat != null && user?.location_lng != null
                        ? { lat: user.location_lat, lng: user.location_lng }
                        : null
                  }
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
                onPress={() =>
                  picked &&
                  acceptLocation({
                    lat: picked.lat,
                    lng: picked.lng,
                    label: picked.label ?? `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`,
                  })
                }
                disabled={!picked}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
