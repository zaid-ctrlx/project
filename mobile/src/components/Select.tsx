import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";
import PickerSheet from "./PickerSheet";

type Props<T extends string> = {
  label: string;
  placeholder?: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T) => void;
  // Visible but inert — "not built yet", same meaning as OptionsMenuItem's
  // disabled (see EventDiscoverView's "Sort" box, its first use).
  disabled?: boolean;
};

// A tap-to-open dropdown styled like TextField's labeled box, so it drops
// into the same profile-edit form without looking out of place. The picker
// itself is PickerSheet (see there) — this just owns the box + open state.
export default function Select<T extends string>({
  label,
  placeholder = "Select...",
  value,
  options,
  onChange,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    box: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
    },
    boxDisabled: { backgroundColor: colors.chipBackground, borderColor: colors.borderLight },
    textCol: { flex: 1 },
    label: { fontSize: fontSize.sm, color: colors.textMuted },
    value: { fontSize: fontSize.md, color: colors.text, paddingTop: spacing.xs, paddingBottom: spacing.sm },
    placeholder: { color: colors.textFaint },
  }));

  return (
    <View>
      <Pressable
        style={[styles.box, disabled && styles.boxDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
      >
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, (!value || disabled) && styles.placeholder]}>{value ?? placeholder}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={disabled ? colors.borderLight : colors.textMuted} />
      </Pressable>

      <PickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        value={value}
        options={options}
        onChange={onChange}
      />
    </View>
  );
}
