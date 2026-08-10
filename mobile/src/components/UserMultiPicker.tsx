import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { mediaUrl } from "../api/client";
import { searchUsers, UserSearchResult } from "../api/profile";
import { colors, fontSize, radius, spacing } from "../theme";
import SearchField from "./SearchField";

const SEARCH_MIN_LENGTH = 2;

type Props = {
  selected: UserSearchResult[];
  onChange: (users: UserSearchResult[]) => void;
  // Hide these from search results — e.g. people already in the group
  // (AddGroupMemberScreen), separate from `selected` (people picked in
  // *this* session, which are filtered out the same way below).
  excludeIds?: string[];
};

// Search-and-pick-many, used by both CreateGroupScreen and
// AddGroupMemberScreen. Picked users render as removable chips above the
// search box; the search box itself reuses the same debounced
// searchUsers(...) flow as MessagesScreen's inline "search to start a chat".
export default function UserMultiPicker({ selected, onChange, excludeIds }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < SEARCH_MIN_LENGTH) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await searchUsers(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hiddenIds = new Set([...selected.map((u) => u.id), ...(excludeIds ?? [])]);
  const visibleResults = results.filter((u) => !hiddenIds.has(u.id));

  function add(user: UserSearchResult) {
    onChange([...selected, user]);
    setQuery("");
    setResults([]);
  }

  function remove(userId: string) {
    onChange(selected.filter((u) => u.id !== userId));
  }

  return (
    <View>
      {selected.length > 0 && (
        <View style={styles.chipRow}>
          {selected.map((u) => (
            <Pressable key={u.id} onPress={() => remove(u.id)} style={styles.chip}>
              <Text style={styles.chipText}>{u.username} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}

      <SearchField placeholder="Search people to add" value={query} onChangeText={setQuery} busy={busy} />

      {visibleResults.map((u) => (
        <Pressable
          key={u.id}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => add(u)}
        >
          {u.avatar_url ? (
            <Image source={{ uri: mediaUrl(u.avatar_url)! }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{u.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.rowText}>
            <Text style={styles.username}>{u.username}</Text>
            {u.full_name && (
              <Text style={styles.fullName} numberOfLines={1}>
                {u.full_name}
              </Text>
            )}
          </View>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.chipBackground,
  },
  chipText: { fontSize: fontSize.base, color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.chipBackground },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  rowText: { flex: 1 },
  username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
});
