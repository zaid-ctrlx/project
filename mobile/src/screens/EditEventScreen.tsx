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

export default function EditEventScreen() {
  const { event } = useRoute<RouteProp<AppStackParamList, "EditEvent">>().params;
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
        <Text style={styles.headerTitle}>Edit {EVENT_KIND_LABELS[event.kind]}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.formWrap}>
        {/* MyPostsScreen refetches on focus, so just going back after a
            successful save is enough for the list there to show the
            update — no need to thread the saved event back through here. */}
        <EventForm initialEvent={event} submitLabel="Save changes" onSaved={() => navigation.goBack()} />
      </View>
    </View>
  );
}
