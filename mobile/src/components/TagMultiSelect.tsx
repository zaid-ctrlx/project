import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Tag } from "../api/auth";
import { fetchTags } from "../api/profile";
import { colors, fontSize, radius, spacing } from "../theme";

type Props = {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
};

// Extracted from ProfileForm's original Interests chip section so it can be
// reused as-is by Create Event's category tags. Fully controlled (the
// parent owns selectedIds) — this component only owns its own tag-list
// fetch/loading state.
export default function TagMultiSelect({ selectedIds, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setTags(await fetchTags());
      } catch {
        // Non-fatal: caller can still submit without tags.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  if (loading) return <ActivityIndicator style={styles.tagsLoading} />;

  return (
    <View style={styles.tagRow}>
      {tags.map((tag) => {
        const selected = selectedIds.has(tag.id);
        return (
          <Pressable key={tag.id} onPress={() => toggle(tag.id)} style={[styles.tagChip, selected && styles.tagChipSelected]}>
            <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
              {tag.name}
              {selected ? "  ✕" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
