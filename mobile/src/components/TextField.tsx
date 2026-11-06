import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native";

import { FONT_REGULAR } from "../lib/fonts";
import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Props = TextInputProps & {
  containerStyle?: object;
  /** When set, renders as a bordered box with a small label above the
   * value (e.g. "Name" / "zaid") instead of a plain input with a
   * placeholder — matches the profile-edit field style. */
  label?: string;
};

// How long a tapped-open password stays readable before going back to dots.
const PEEK_MS = 800;

export default function TextField({ style, containerStyle, label, secureTextEntry, ...rest }: Props) {
  // Password fields get an eye button. It is deliberately a *peek*, not a
  // toggle: tapping shows the text for a second, then it hides itself again,
  // so a password is never left on screen.
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current); }, []);

  function peek() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  }

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
      fontFamily: FONT_REGULAR,
    },
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
    inputWithEye: { paddingRight: 52 },
    eye: { position: "absolute", right: 0, top: 0, bottom: 0, width: 48, alignItems: "center", justifyContent: "center" },
    labeledInput: {
      fontFamily: FONT_REGULAR,
      fontSize: fontSize.md,
      color: colors.text,
      padding: 0,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
    },
  }));

  const eye = secureTextEntry ? (
    <Pressable
      onPress={peek}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Show password briefly"
      style={styles.eye}
    >
      <Ionicons name={peeking ? "eye" : "eye-off-outline"} size={20} color={colors.textMuted} />
    </Pressable>
  ) : null;
  const hidden = secureTextEntry && !peeking;

  if (label) {
    return (
      <View style={[styles.labeledBox, containerStyle]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.labeledInput, secureTextEntry && styles.inputWithEye, style]}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={hidden}
          {...rest}
        />
        {eye}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <TextInput
        style={[styles.input, secureTextEntry && styles.inputWithEye, style]}
        placeholderTextColor={colors.textFaint}
        secureTextEntry={hidden}
        {...rest}
      />
      {eye}
    </View>
  );
}
