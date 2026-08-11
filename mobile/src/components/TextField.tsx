import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = TextInputProps & {
  containerStyle?: object;
  /** When set, renders as a bordered box with a small label above the
   * value (e.g. "Name" / "zaid") instead of a plain input with a
   * placeholder — matches the profile-edit field style. */
  label?: string;
};

export default function TextField({ style, containerStyle, label, ...rest }: Props) {
  const { styles, colors } = useThemedStyles((colors) => ({
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.md,
      color: colors.text,
      backgroundColor: colors.background,
    },
    labeledBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: colors.background,
    },
    label: { fontSize: fontSize.sm, color: colors.textMuted },
    labeledInput: {
      fontSize: fontSize.md,
      color: colors.text,
      padding: 0,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
  }));

  if (label) {
    return (
      <View style={[styles.labeledBox, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.labeledInput, style]}
          placeholderTextColor={colors.textFaint}
          {...rest}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.textFaint} {...rest} />
    </View>
  );
}
