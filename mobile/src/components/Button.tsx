import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { useThemedStyles } from "../hooks/useThemedStyles";
import { fontSize, radius, spacing } from "../theme";

type Variant = "primary" | "secondary" | "text";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

// One button component for the whole app: primary (solid), secondary
// (outlined), or text (plain link-style, e.g. "Log out" / "Back"). Handles
// its own disabled/loading/pressed states so every screen looks consistent
// instead of each one styling Pressable+Text by hand.
export default function Button({ label, onPress, variant = "primary", loading, disabled, danger }: Props) {
  const isDisabled = disabled || loading;
  const { styles, colors } = useThemedStyles((colors) => ({
    base: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    // Violet fill with a soft ambient glow, per the design system's
    // "Go Do It" primary button.
    primary: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    secondary: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
    dangerBox: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger, shadowOpacity: 0, elevation: 0 },
    disabled: { opacity: 0.4 },
    disabledLabel: { opacity: 0.6 },
    pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    primaryLabel: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: "700" },
    secondaryLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
    textLabel: { color: colors.text, fontSize: fontSize.base, fontWeight: "600" },
    dangerLabel: { color: colors.danger },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        variant !== "text" && styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        danger && variant !== "text" && styles.dangerBox,
        isDisabled && variant !== "text" && styles.disabled,
        pressed && !isDisabled && variant !== "text" && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryText : colors.text} />
      ) : (
        <Text
          style={[
            variant === "primary" && styles.primaryLabel,
            variant === "secondary" && styles.secondaryLabel,
            variant === "text" && styles.textLabel,
            danger && styles.dangerLabel,
            isDisabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
