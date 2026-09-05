import React from "react";
import { FlatList, Text, View } from "react-native";

import { MapItem } from "../api/map";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import MapPreviewSheet from "./MapPreviewSheet";

type Props = { items: MapItem[]; loading: boolean; error: string | null; selected: MapItem | null; onSelect: (item: MapItem) => void; onClose: () => void; onView: (item: MapItem) => void; busy: boolean };
export default function DiscoverMapView({ items, loading, error, selected, onSelect, onClose, onView, busy }: Props) {
  const { styles } = useThemedStyles((colors) => ({ wrapper: { flex: 1 }, notice: { color: colors.textMuted, textAlign: "center", marginBottom: spacing.md, fontSize: fontSize.sm }, row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, title: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" }, meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs } }));
  return <View style={styles.wrapper}>
    <Text style={styles.notice}>{loading ? "Loading map posts…" : error ?? "Map preview is shown as a list on web."}</Text>
    <FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <View style={styles.row}><Text style={styles.title} onPress={() => onSelect(item)}>{item.name}</Text><Text style={styles.meta}>{EVENT_KIND_LABELS[item.type]} · {item.location_name ?? "Location unavailable"}</Text></View>} ListEmptyComponent={!loading ? <Text style={styles.notice}>No in-person posts in this area yet.</Text> : null} />
    <MapPreviewSheet item={selected} onClose={onClose} onView={onView} busy={busy} />
  </View>;
}
