import React, { useState } from "react";
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

export default function TextField({ style, containerStyle, label, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const { styles, colors } = useThemedStyles((colors) => ({
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.md,
      color: colors.text,
      backgroundColor: colors.surface,
      minHeight: 48,
    },
    focused: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
    labeledBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: colors.surface,
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
      <View style={[styles.labeledBox, focused && styles.focused, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.labeledInput, style]}
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <TextInput
        style={[styles.input, focused && styles.focused, style]}
        placeholderTextColor={colors.textFaint}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
    </View>
  );
}
