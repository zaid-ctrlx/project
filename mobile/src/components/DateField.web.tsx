import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../context/ThemeContext";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = {
  label: string;
  value: string | null; // "YYYY-MM-DD" or null
  onChange: (day: string | null) => void;
  minDay?: string | null;
};

// Web: the browser's own <input type="date"> (the datetimepicker package has
// no web implementation), styled to match the native field.
export default function DateField({ label, value, onChange, minDay }: Props) {
  const { mode } = useTheme();
  const { styles, colors } = useThemedStyles((colors) => ({
    box: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
    },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.textFaint },
  }));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.box}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          {value ? (
            <Pressable onPress={() => onChange(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        <input
          type="date"
          value={value ?? ""}
          min={minDay ?? undefined}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: fontSize.base,
            color: colors.text,
            colorScheme: mode,
            fontFamily: "PlusJakartaSans_600SemiBold, system-ui, sans-serif",
            width: "100%",
            padding: 0,
            marginTop: 2,
          }}
        />
      </View>
    </View>
  );
}
