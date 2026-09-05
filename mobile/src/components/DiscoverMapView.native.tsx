import ClusteredMapView from "react-native-map-clustering";
import { Marker } from "react-native-maps";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { MapItem } from "../api/map";
import { MAP_MARKER_COLORS } from "../constants/mapMarkers";
import { KARNATAKA_INITIAL_REGION } from "../constants/mapRegion";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import MapPreviewSheet from "./MapPreviewSheet";

type Props = { items: MapItem[]; loading: boolean; error: string | null; selected: MapItem | null; onSelect: (item: MapItem) => void; onClose: () => void; onView: (item: MapItem) => void; busy: boolean };

export default function DiscoverMapView({ items, loading, error, selected, onSelect, onClose, onView, busy }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, overflow: "hidden", borderRadius: radius.md },
    map: { flex: 1 },
    status: { position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, alignItems: "center" },
    statusText: { backgroundColor: colors.background, color: colors.text, padding: spacing.sm, borderRadius: radius.sm, fontSize: fontSize.sm },
  }));
  return (
    <View style={styles.wrapper}>
      <ClusteredMapView style={styles.map} initialRegion={KARNATAKA_INITIAL_REGION} minZoomLevel={5} maxZoomLevel={18} spiralEnabled={false} showsUserLocation={false} showsMyLocationButton={false}>
        {items.map((item) => <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} pinColor={MAP_MARKER_COLORS[item.type]} title={item.name} description={item.location_name ?? undefined} onPress={() => onSelect(item)} />)}
      </ClusteredMapView>
      {(loading || error || items.length === 0) && <View pointerEvents="none" style={styles.status}>{loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.statusText}>{error ?? "No in-person posts in this area yet."}</Text>}</View>}
      <MapPreviewSheet item={selected} onClose={onClose} onView={onView} busy={busy} />
    </View>
  );
}
