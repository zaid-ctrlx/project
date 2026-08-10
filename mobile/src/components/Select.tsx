import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props<T extends string> = {
  label: string;
  placeholder?: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T) => void;
};

// A tap-to-open dropdown styled like TextField's labeled box, so it drops
// into the same profile-edit form without looking out of place. Options
// render in a centered modal sheet rather than a native <Picker> — keeps
// look-and-feel identical across iOS/Android/web without an extra native
// dependency.
export default function Select<T extends string>({
  label,
  placeholder = "Select...",
  value,
  options,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable style={styles.box} onPress={() => setOpen(true)}>
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, !value && styles.placeholder]}>{value ?? placeholder}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {/* Bounded + scrollable so option lists longer than a screenful
                (e.g. Create Event's ~20-option Activity Type) still work —
                short lists like Gender just render without scrolling. */}
            <ScrollView bounces={false}>
              {options.map((option, i) => {
                const selected = value === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      i < options.length - 1 && styles.optionBorder,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  textCol: { flex: 1 },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontSize: fontSize.md, color: colors.text, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  placeholder: { color: colors.textFaint },
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
    maxHeight: "75%",
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
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  optionPressed: { backgroundColor: colors.chipBackground },
  optionText: { fontSize: fontSize.md, color: colors.text },
  optionTextSelected: { fontWeight: "600" },
});
