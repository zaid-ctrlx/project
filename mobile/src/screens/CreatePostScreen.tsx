import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import EventForm from "../components/EventForm";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
import { useThemedStyles } from "../hooks/useThemedStyles";
import type { AppStackParamList } from "../navigation/AppStack";
import { fontSize, spacing } from "../theme";

// Pushed from Profile's top-left "+" button, which now opens a picker
// (Event vs Community — see ProfileScreen) instead of going straight here;
// this screen just needs to know which kind it's creating. My Posts
// (formerly My Events) refetches on every focus, so just going back after a
// successful create is enough for it to show up there — same reasoning as
// EditEventScreen.
export default function CreatePostScreen() {
  const { kind } = useRoute<RouteProp<AppStackParamList, "CreatePost">>().params;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
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
    formWrap: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  }));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Create {EVENT_KIND_LABELS[kind]}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.formWrap}>
        <EventForm kind={kind} submitLabel={`Create ${EVENT_KIND_LABELS[kind].toLowerCase()}`} onSaved={() => navigation.goBack()} />
      </View>
    </View>
  );
}
