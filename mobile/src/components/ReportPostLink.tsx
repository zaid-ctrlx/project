import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, spacing } from "../theme";
import ReportSheet from "./ReportSheet";

// "Report this post" link + its sheet, for the bottom of an event or
// community page. Only render it for posts you didn't create.
export default function ReportPostLink({ eventId, title }: { eventId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    link: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", marginTop: spacing.lg, paddingVertical: spacing.xs },
    text: { fontSize: fontSize.sm, color: colors.textFaint },
  }));
  return (
    <>
      <Pressable style={styles.link} onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
        <Ionicons name="flag-outline" size={14} color={colors.textFaint} />
        <Text style={styles.text}>Report this post</Text>
      </Pressable>
      <ReportSheet visible={open} onClose={() => setOpen(false)} targetType="event" targetId={eventId} targetName={`"${title}"`} />
    </>
  );
}
