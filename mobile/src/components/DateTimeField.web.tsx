import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

// @react-native-community/datetimepicker has no web implementation — its
// generic (non-.ios/.android/.windows) fallback just logs a warning and
// renders null (see its src/datetimepicker.js) — and DateTimeField.tsx only
// ever mounts the picker Modal on iOS, so on web the field was a dead click.
// Metro resolves *.web.tsx over the plain .tsx automatically when bundling
// for web (the same convention the picker library itself uses internally),
// so this file is a drop-in swap: no changes needed where DateTimeField is
// used. Falls back to the browser's native <input type="datetime-local">,
// which brings its own picker UI.
function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function DateTimeField({ label, value, onChange, minimumDate }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="datetime-local"
        value={value ? toInputValue(value) : ""}
        min={minimumDate ? toInputValue(minimumDate) : undefined}
        onChange={(e) => {
          // datetime-local values with no timezone offset parse as local
          // time via the Date constructor — matches what this field means.
          const raw = e.target.value;
          if (raw) onChange(new Date(raw));
        }}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: fontSize.md,
          color: colors.text,
          fontFamily: "inherit",
          width: "100%",
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors DateTimeField.tsx's box styling for visual consistency with the
  // rest of the form (and with Select.tsx, which the native version also
  // matches).
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
});
