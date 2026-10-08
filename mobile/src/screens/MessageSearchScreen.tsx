import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { mediaUrl } from "../api/client";
import { searchUsers, UserSearchResult } from "../api/profile";
import SearchField from "../components/SearchField";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

const SEARCH_MIN_LENGTH = 2;

// Pushed from Messages' search bar — was inline there, moved out since a
// real stack push hides the bottom tab bar and gets swipe-back/hardware-back
// for free, which a same-screen "search mode" toggle on MessagesScreen
// couldn't do.
export default function MessageSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearching = query.trim().length >= SEARCH_MIN_LENGTH;
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    searchFieldWrap: { flex: 1 },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderRadius: spacing.sm },
    rowPressed: { backgroundColor: colors.chipBackground },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
    avatarText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    rowText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    preview: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.xs },
    emptyBody: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
  }));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!isSearching) {
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
  }, [query, isSearching]);

  function goToChat(userId: string, username: string, avatarUrl: string | null) {
    navigation.navigate("Chat", { userId, username, avatarUrl });
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.searchFieldWrap}>
          <SearchField placeholder="Search people to message" value={query} onChangeText={setQuery} busy={busy} autoFocus />
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => goToChat(item.id, item.username, item.avatar_url)}
          >
            {item.avatar_url ? (
              <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={styles.username}>{item.username}</Text>
              {item.full_name && (
                <Text style={styles.preview} numberOfLines={1}>
                  {item.full_name}
                </Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          isSearching && !busy ? (
            <Text style={styles.emptyBody}>No users found.</Text>
          ) : !isSearching ? (
            <Text style={styles.emptyBody}>Search for a username to start a conversation.</Text>
          ) : null
        }
      />
    </View>
  );
}
