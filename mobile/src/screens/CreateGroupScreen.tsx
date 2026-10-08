import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { ApiError, mediaUrl } from "../api/client";
import { createGroup, uploadGroupAvatar } from "../api/groups";
import { DmConversation, listConversations } from "../api/messages";
import { searchUsers } from "../api/profile";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import TextField from "../components/TextField";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, radius, spacing } from "../theme";

type Person = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type PickedPhoto = { file: Blob; mimeType: string; previewUri: string };

const SEARCH_MIN_LENGTH = 2;

// Two-step wizard: 1) tick who's in the group (defaults to people you've
// already DMed — "your contacts" — with a search box to reach anyone else),
// 2) name it and optionally set a photo. Kept as one screen with local
// `step` state rather than two stack routes — the two steps share
// `selected`, and going "back" from step 2 should just re-reveal step 1
// with everything intact, not pop a screen.
export default function CreateGroupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"members" | "details">("members");

  // --- Step 1: who's in the group ---
  const [contacts, setContacts] = useState<Person[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Map<string, Person>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        // listConversations() merges DMs and groups (see api/messages.ts) —
        // "people I'm in contact with" is just its DM rows' other_user.
        const conversations = await listConversations();
        const dms = conversations.filter((c): c is DmConversation => c.type === "dm");
        setContacts(dms.map((c) => c.other_user));
      } catch {
        // Non-fatal — contact list just starts empty; search below still works.
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, []);

  const isSearching = query.trim().length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isSearching) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setSearchResults(await searchUsers(query.trim()));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isSearching]);

  // Deliberately not hiding already-selected people from either list (unlike
  // UserMultiPicker's chip-based flow) — showing them ticked, in place, is
  // clearer here and lets you un-tick from search results too.
  const listData = isSearching ? searchResults : contacts;

  function toggle(person: Person) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  }

  // --- Step 2: name + photo + create ---
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoPicking, setPhotoPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    wrapper: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
    headerSpacer: { width: 26 },

    // --- Step 1 ---
    membersContainer: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    sectionTitle: {
      fontSize: fontSize.base,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    spinner: { marginTop: spacing.xl },
    list: { paddingBottom: 96 }, // clears the floating arrow button
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderRadius: spacing.sm,
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.chipBackground },
    avatarSm: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImageSm: { width: 44, height: 44, borderRadius: 22 },
    avatarSmText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
    rowText: { flex: 1 },
    username: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
    fullName: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    emptyBody: { fontSize: fontSize.base, color: colors.textFaint, textAlign: "center", marginTop: spacing.xl },
    fab: {
      position: "absolute",
      right: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },

    // --- Step 2 ---
    detailsContainer: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    avatarSection: { alignItems: "center", marginBottom: spacing.sm },
    avatarWrap: { width: 96, height: 96, alignSelf: "center" },
    avatarImage: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    changePhotoText: { color: colors.primary, fontSize: fontSize.base, fontWeight: "600", marginTop: spacing.sm },
    memberSummary: { fontSize: fontSize.sm, color: colors.textMuted },
    error: { color: colors.danger, fontSize: fontSize.base },

    // --- Photo-source sheet (mirrors ProfileForm's) ---
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    sheet: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: "hidden",
      paddingVertical: spacing.sm,
    },
    sheetTitle: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    sheetOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    sheetOptionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    sheetOptionPressed: { backgroundColor: colors.chipBackground },
    sheetOptionText: { fontSize: fontSize.md, color: colors.text, textAlign: "center" },
    sheetCancelText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: "center" },
  }));

  // Mirrors ProfileForm's pickAndUploadAvatar (permission -> launch ->
  // resize) but stops short of uploading — the group doesn't exist yet, so
  // this just stores the resized file + a local preview uri; onCreate below
  // uploads it once there's a group id to attach it to.
  async function pickPhoto(source: "camera" | "library") {
    setPhotoSheetOpen(false);
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera permission denied. Enable it in your device settings to take a photo."
          : "Photo library permission denied. Enable it in your device settings to choose a photo."
      );
      return;
    }

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled || !result.assets?.length) return;

    setPhotoPicking(true);
    try {
      const resized = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: 640, height: 640 })
        .renderAsync();
      const saved = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      const file: Blob =
        Platform.OS === "web" ? await (await fetch(saved.uri)).blob() : (new File(saved.uri) as unknown as Blob);
      setPhoto({ file, mimeType: "image/jpeg", previewUri: saved.uri });
    } catch (err) {
      console.error("Group photo pick failed:", err);
      setError(err instanceof Error ? `Couldn't use that photo: ${err.message}` : "Couldn't use that photo. Try again.");
    } finally {
      setPhotoPicking(false);
    }
  }

  async function onCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }

    setSaving(true);
    try {
      const group = await createGroup(
        name.trim(),
        Array.from(selected.keys())
      );
      if (photo) {
        // Best-effort — the group itself was already created successfully;
        // a failed photo upload shouldn't block opening it. There's no
        // group-settings screen to retry from yet, so this is silent
        // beyond the console log (matching sendMessage's fire-and-forget
        // WS push tradeoff elsewhere in this app).
        try {
          await uploadGroupAvatar(group.id, photo);
        } catch (err) {
          console.error("Group photo upload failed:", err);
        }
      }
      navigation.replace("GroupChat", { groupId: group.id, groupName: group.name, memberCount: group.members.length });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the group. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (step === "details") {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => setStep("members")} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Group Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.detailsContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <Pressable onPress={() => setPhotoSheetOpen(true)} disabled={photoPicking} style={styles.avatarWrap}>
              {photo ? (
                <Image source={{ uri: photo.previewUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="people" size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                {photoPicking ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.primaryText} />
                )}
              </View>
            </Pressable>
            <Pressable onPress={() => setPhotoSheetOpen(true)} disabled={photoPicking} hitSlop={8}>
              <Text style={styles.changePhotoText}>{photo ? "Change photo" : "Add group photo"}</Text>
            </Pressable>
          </View>

          <TextField
            label="Group name"
            placeholder="e.g. Weekend Hikers"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          <Text style={styles.memberSummary}>
            {selected.size} {selected.size === 1 ? "member" : "members"} selected
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Create group" onPress={onCreate} loading={saving} />
        </ScrollView>

        {/* Same custom-sheet pattern as ProfileForm's avatar-source picker. */}
        <Modal visible={photoSheetOpen} transparent animationType="fade" onRequestClose={() => setPhotoSheetOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPhotoSheetOpen(false)}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Group photo</Text>
              <Pressable
                onPress={() => pickPhoto("camera")}
                style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
              >
                <Text style={styles.sheetOptionText}>Take Photo</Text>
              </Pressable>
              <Pressable
                onPress={() => pickPhoto("library")}
                style={({ pressed }) => [styles.sheetOption, styles.sheetOptionBorder, pressed && styles.sheetOptionPressed]}
              >
                <Text style={styles.sheetOptionText}>Choose from Library</Text>
              </Pressable>
              <Pressable
                onPress={() => setPhotoSheetOpen(false)}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.sheetOptionPressed]}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.membersContainer}>
        <SearchField placeholder="Search people" value={query} onChangeText={setQuery} busy={searching} />

        {!isSearching && <Text style={styles.sectionTitle}>Your contacts</Text>}

        {loadingContacts && !isSearching ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = selected.has(item.id);
              return (
                <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => toggle(item)}>
                  {item.avatar_url ? (
                    <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatarImageSm} />
                  ) : (
                    <View style={styles.avatarSm}>
                      <Text style={styles.avatarSmText}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.username}>{item.username}</Text>
                    {item.full_name && (
                      <Text style={styles.fullName} numberOfLines={1}>
                        {item.full_name}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={isSelected ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyBody}>
                {isSearching ? "No users found." : "No conversations yet — search above to find people."}
              </Text>
            }
          />
        )}
      </View>

      {selected.size > 0 && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + spacing.xl }]} onPress={() => setStep("details")}>
          <Ionicons name="arrow-forward" size={26} color={colors.primaryText} />
        </Pressable>
      )}
    </View>
  );
}
