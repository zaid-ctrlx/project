import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "../theme";

type Props<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T) => void;
};

// The picker-modal half of Select.tsx, pulled out so it can be opened from
// somewhere other than Select's own labeled box — e.g. a menu item
// (EventsScreen's ⋯ "Filter" row) that has no box of its own to show,
// just a value to pick. Select renders this internally too, so there's one
// picker-sheet implementation instead of two near-identical ones.
export default function PickerSheet<T extends string>({ visible, onClose, title, value, options, onChange }: Props<T>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {/* Bounded + scrollable so option lists longer than a screenful
              (e.g. Create Event's ~20-option Activity Type) still work —
              short lists like this one just render without scrolling. */}
          <ScrollView bounces={false}>
            {options.map((option, i) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    onChange(option);
                    onClose();
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
  );
}

const styles = StyleSheet.create({
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
  title: {
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
