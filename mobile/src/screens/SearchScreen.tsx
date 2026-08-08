import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { searchUsers, UserSearchResult } from "../api/profile";
import TextField from "../components/TextField";
import { colors, fontSize, spacing } from "../theme";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await searchUsers(query.trim());
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearched(true);
        setBusy(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchField}>
        <TextField
          placeholder="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {busy && <ActivityIndicator style={styles.spinner} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.resultText}>
              <Text style={styles.username}>@{item.username}</Text>
              {item.full_name && <Text style={styles.fullName}>{item.full_name}</Text>}
              {item.tags.length > 0 && (
                <Text style={styles.tags}>{item.tags.map((t) => t.name).join(" · ")}</Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          searched && !busy ? <Text style={styles.empty}>No users found.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text, marginBottom: spacing.lg },
  searchField: { justifyContent: "center" },
  spinner: { position: "absolute", right: spacing.md },
  list: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  resultRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chipBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  resultText: { flex: 1 },
  username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  fullName: { fontSize: fontSize.base, color: colors.textMuted },
  tags: { fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs },
  empty: { textAlign: "center", color: colors.textFaint, marginTop: spacing.xl },
});
